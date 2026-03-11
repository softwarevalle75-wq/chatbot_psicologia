import type { Message } from '../types';

export const mockMessages: Message[] = [
  {
    id: '1',
    sender: 'bot',
    content: 'Hola, ¿cómo te sientes el día de hoy? Estoy aquí para escucharte.',
    timestamp: '10:42 AM',
  },
  {
    id: '2',
    sender: 'user',
    content:
      'Me he sentido un poco ansioso por el trabajo últimamente. Siento que no me alcanza el tiempo.',
    timestamp: '10:43 AM',
  },
  {
    id: '3',
    sender: 'bot',
    content:
      'Entiendo perfectamente. Esa sensación de falta de tiempo puede ser muy abrumadora. ¿Te gustaría realizar un ejercicio corto de respiración o prefieres hablar más sobre lo que te genera esa ansiedad?',
    timestamp: '10:43 AM',
  },
  {
    id: '4',
    sender: 'user',
    content: 'Creo que prefiero hablarlo un poco más antes de los ejercicios.',
    timestamp: '10:44 AM',
  },
];
