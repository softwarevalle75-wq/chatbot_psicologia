import 'dotenv/config';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { prisma } from '../src/lib/prisma.js';

const hasFlag = (flag) => process.argv.includes(flag);
const argValue = (name, fallback = null) => {
  const pref = `${name}=`;
  const raw = process.argv.find((v) => v.startsWith(pref));
  return raw ? raw.slice(pref.length) : fallback;
};

const DRY_RUN = hasFlag('--dry-run') || String(process.env.BACKFILL_DRY_RUN || '').trim() === '1';
const LIMIT = Number(argValue('--limit', process.env.BACKFILL_EMAILS_LIMIT || 0)) || 0;
const BATCH_SIZE = Math.max(10, Number(argValue('--batch', process.env.BACKFILL_EMAILS_BATCH || 100)) || 100);
const MAILBOX_FROM_ENV = String(process.env.BACKFILL_EMAILS_MAILBOX || '').trim();
const SINCE_RAW = String(argValue('--since', process.env.BACKFILL_EMAILS_SINCE || '') || '').trim();

const SMTP_USER = String(process.env.SMTP_USER || '').trim().toLowerCase();
const IMAP_HOST = String(process.env.IMAP_HOST || 'imap.gmail.com').trim();
const IMAP_PORT = Number(process.env.IMAP_PORT || 993);
const IMAP_SECURE = String(process.env.IMAP_SECURE || 'true').toLowerCase() !== 'false';
const IMAP_USER = String(process.env.IMAP_USER || process.env.SMTP_USER || '').trim();
const IMAP_PASS = String(process.env.IMAP_PASS || process.env.SMTP_PASS || '').trim();

const SENT_NAME_FALLBACKS = [
  '[Gmail]/Sent Mail',
  '[Gmail]/Enviados',
  'Sent',
  'Sent Mail',
  'Sent Messages',
  'Enviados',
];

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

const sourceToBuffer = async (source) => {
  if (!source) return Buffer.alloc(0);
  if (Buffer.isBuffer(source)) return source;
  if (typeof source === 'string') return Buffer.from(source);

  if (typeof source.pipe === 'function') {
    const chunks = [];
    for await (const chunk of source) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  return Buffer.alloc(0);
};

const cleanPhone = (value) => String(value || '').replace(/[^\d]/g, '');

const extractPhoneFromHtml = (html = '') => {
  if (!html) return '';

  const tableRegex = /Tel[eE]fono<\/td>\s*<td[^>]*>\s*([^<]+)/i;
  const tableMatch = html.match(tableRegex);
  if (tableMatch?.[1]) {
    const phone = cleanPhone(tableMatch[1]);
    if (phone.length >= 10) return phone;
  }

  const looseRegex = /Tel[eE]fono[^\d+]*([+\d][\d\s\-().]{7,})/i;
  const looseMatch = html.match(looseRegex);
  if (looseMatch?.[1]) {
    const phone = cleanPhone(looseMatch[1]);
    if (phone.length >= 10) return phone;
  }

  return '';
};

const extractPhoneFromText = (text = '') => {
  if (!text) return '';
  const m = text.match(/Tel[eE]fono[^\d+]*([+\d][\d\s\-().]{7,})/i);
  if (!m?.[1]) return '';
  const phone = cleanPhone(m[1]);
  return phone.length >= 10 ? phone : '';
};

const extractPhoneFromFilenames = (filenames = []) => {
  for (const name of filenames) {
    const m = String(name || '').match(/(\d{10,15})/);
    if (m?.[1]) return m[1];
  }
  return '';
};

const detectTest = (subject = '', text = '', filenames = []) => {
  const haystack = `${subject} ${text} ${filenames.join(' ')}`.toLowerCase();
  if (haystack.includes('ghq-12') || haystack.includes('ghq12')) {
    return { tipo: 'ghq12', nombre: 'GHQ-12' };
  }
  if (haystack.includes('dass-21') || haystack.includes('dass21')) {
    return { tipo: 'dass21', nombre: 'DASS-21' };
  }
  return { tipo: 'otro', nombre: '' };
};

const extractPractitionerName = ({ html = '', text = '', toName = '' }) => {
  const htmlMatch = html.match(/Estimado\/?a?\s*<strong>([^<]{2,120})<\/strong>/i);
  if (htmlMatch?.[1]) return String(htmlMatch[1]).trim();

  const textMatch = text.match(/Estimado\/?a?\s+([^,\n]{2,120})/i);
  if (textMatch?.[1]) return String(textMatch[1]).trim();

  return String(toName || '').trim();
};

const parseSince = (raw) => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const resolveSentMailbox = async (client) => {
  if (MAILBOX_FROM_ENV) return MAILBOX_FROM_ENV;

  const boxes = await client.list();

  const bySpecialUse = boxes.find((box) => String(box.specialUse || '').toLowerCase() === '\\sent');
  if (bySpecialUse?.path) return bySpecialUse.path;

  const lowerPaths = boxes.map((box) => ({ path: box.path, low: String(box.path || '').toLowerCase() }));
  for (const fallback of SENT_NAME_FALLBACKS) {
    const found = lowerPaths.find((box) => box.low === fallback.toLowerCase());
    if (found?.path) return found.path;
  }

  const fuzzy = lowerPaths.find((box) => box.low.includes('sent') || box.low.includes('enviad'));
  return fuzzy?.path || 'INBOX';
};

const messageAlreadyTracked = async ({ messageId, phone, practitionerEmail, sentAt, testTipo }) => {
  if (messageId) {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT id FROM envios_correo WHERE message_id = ? LIMIT 1',
      String(messageId),
    ).catch(() => []);
    if (rows.length > 0) return true;
  }

  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT id
    FROM envios_correo
    WHERE telefono_paciente = ?
      AND correo_practicante = ?
      AND test_tipo = ?
      AND ABS(TIMESTAMPDIFF(MINUTE, fecha_envio, ?)) <= 2
    LIMIT 1
    `,
    String(phone),
    String(practitionerEmail),
    String(testTipo),
    sentAt,
  ).catch(() => []);

  return rows.length > 0;
};

const insertTrackingRow = async ({
  phone,
  practitionerEmail,
  practitionerName,
  testTipo,
  testNombre,
  pdfName,
  messageId,
  sentAt,
}) => {
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO envios_correo
      (telefono_paciente, correo_practicante, nombre_practicante, test_tipo, test_nombre, pdf_nombre, message_id, fecha_envio)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    String(phone),
    String(practitionerEmail),
    String(practitionerName || ''),
    String(testTipo),
    String(testNombre || ''),
    String(pdfName || ''),
    String(messageId || ''),
    sentAt,
  );
};

async function main() {
  if (!IMAP_USER || !IMAP_PASS) {
    throw new Error('Faltan credenciales IMAP. Configura IMAP_USER/IMAP_PASS o SMTP_USER/SMTP_PASS.');
  }

  const sinceDate = parseSince(SINCE_RAW);
  const imap = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_SECURE,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false,
  });

  const stats = {
    scanned: 0,
    matched: 0,
    inserted: 0,
    skippedNoSubject: 0,
    skippedNoPdf: 0,
    skippedNoPhone: 0,
    skippedNoRecipient: 0,
    skippedNoTest: 0,
    skippedSenderMismatch: 0,
    skippedAlreadyTracked: 0,
    parseErrors: 0,
  };

  const samples = [];

  try {
    console.log('Conectando a IMAP...');
    await imap.connect();

    const mailbox = await resolveSentMailbox(imap);
    console.log(`Buzon seleccionado: ${mailbox}`);
    await imap.mailboxOpen(mailbox, { readOnly: true });

    const criteria = {};
    if (sinceDate) criteria.since = sinceDate;
    else criteria.all = true;

    let uids = await imap.search(criteria, { uid: true });
    uids = [...uids].sort((a, b) => a - b);
    if (LIMIT > 0 && uids.length > LIMIT) {
      uids = uids.slice(uids.length - LIMIT);
    }

    console.log(`Mensajes candidatos: ${uids.length}`);

    for (let i = 0; i < uids.length; i += BATCH_SIZE) {
      const batch = uids.slice(i, i + BATCH_SIZE);
      for await (const message of imap.fetch(batch, {
        uid: true,
        envelope: true,
        source: true,
        internalDate: true,
      })) {
        stats.scanned++;
        try {
          const raw = await sourceToBuffer(message.source);
          const parsed = await simpleParser(raw);

          const subject = String(parsed.subject || message.envelope?.subject || '').trim();
          if (!subject) {
            stats.skippedNoSubject++;
            continue;
          }

          if (!/informe/i.test(subject)) continue;

          const attachments = (parsed.attachments || []).filter((a) =>
            String(a.filename || '').toLowerCase().endsWith('.pdf'),
          );
          if (attachments.length === 0) {
            stats.skippedNoPdf++;
            continue;
          }

          const fromEmail = normalizeEmail(parsed.from?.value?.[0]?.address || message.envelope?.from?.[0]?.address || '');
          if (SMTP_USER && fromEmail && fromEmail !== SMTP_USER) {
            stats.skippedSenderMismatch++;
            continue;
          }

          const toEmail = normalizeEmail(parsed.to?.value?.[0]?.address || message.envelope?.to?.[0]?.address || '');
          if (!toEmail) {
            stats.skippedNoRecipient++;
            continue;
          }

          const filenames = attachments.map((a) => String(a.filename || ''));
          const test = detectTest(subject, String(parsed.text || ''), filenames);
          if (test.tipo === 'otro') {
            stats.skippedNoTest++;
            continue;
          }

          const html = String(parsed.html || '');
          const text = String(parsed.text || '');
          const phone = (
            extractPhoneFromHtml(html)
            || extractPhoneFromText(text)
            || extractPhoneFromFilenames(filenames)
          );
          if (!phone) {
            stats.skippedNoPhone++;
            continue;
          }

          const sentAt = parsed.date || message.envelope?.date || message.internalDate || new Date();
          const messageId = String(parsed.messageId || message.envelope?.messageId || '').trim();
          const practitionerName = extractPractitionerName({
            html,
            text,
            toName: parsed.to?.value?.[0]?.name || message.envelope?.to?.[0]?.name || '',
          });

          stats.matched++;

          const alreadyTracked = await messageAlreadyTracked({
            messageId,
            phone,
            practitionerEmail: toEmail,
            sentAt,
            testTipo: test.tipo,
          });

          if (alreadyTracked) {
            stats.skippedAlreadyTracked++;
            continue;
          }

          const row = {
            phone,
            practitionerEmail: toEmail,
            practitionerName,
            testTipo: test.tipo,
            testNombre: test.nombre,
            pdfName: filenames[0] || '',
            messageId,
            sentAt,
          };

          if (!DRY_RUN) {
            await insertTrackingRow(row);
          }
          stats.inserted++;

          if (samples.length < 5) {
            samples.push({
              phone,
              practitionerEmail: toEmail,
              testTipo: test.tipo,
              sentAt,
              messageId,
            });
          }
        } catch (error) {
          stats.parseErrors++;
          console.error(`Error parseando UID ${message.uid}:`, error?.message || error);
        }
      }
      console.log(`Procesados ${Math.min(i + BATCH_SIZE, uids.length)} / ${uids.length}`);
    }

    console.log('\nBackfill finalizado');
    console.log(JSON.stringify({ mode: DRY_RUN ? 'dry-run' : 'write', stats, samples }, null, 2));
  } finally {
    try {
      await imap.logout();
    } catch {}
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fallo backfill de envios_correo:', error);
  process.exit(1);
});
