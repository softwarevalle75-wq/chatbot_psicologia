# K6 Load Tests

## 1) Iniciar la app

Primero asegúrate de tener el bot/web levantado:

```bash
npm run start
```

Si usas otro puerto, pásalo en `BASE_URL` al ejecutar k6.

## 2) Prueba rápida

```bash
npm run k6:quick
```

## 3) Prueba de saturación

```bash
npm run k6:saturation
```

## 3.1) Prueba de saturación sin login (solo endpoints públicos)

```bash
npm run k6:saturation-public
```

También puedes exportar resumen:

```bash
k6 run -e BASE_URL=http://localhost:3008 --summary-export=./performance/k6/summary-public.json ./performance/k6/saturation-public.js
```

También puedes ejecutarla directo con URL personalizada:

```bash
k6 run -e BASE_URL=http://localhost:3008 ./performance/k6/saturation.js
```

## 4) Guardar resultados

```bash
k6 run -e BASE_URL=http://localhost:3008 --summary-export=./performance/k6/summary.json ./performance/k6/saturation.js
```

## 5) Criterio práctico de capacidad máxima

Toma como límite el último nivel antes de que se rompan estos umbrales:

- `http_req_failed < 10%`
- `p95 < 1500ms`
- `p99 < 3000ms`

Cuando esos valores se superan de forma sostenida, ese tramo ya está saturado.
