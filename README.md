# Nexora · Demo de alquiler de bicicletas

Demostración de portafolio para el proyecto *“Sitio web con panel de administración (CMS)”*.
Nexora representa un **servicio de alquiler de bicicletas** urbanas con movilidad sostenible:
sitio público + panel administrativo, sin backend real.

## Cómo ejecutarla

Los datos se cargan desde archivos JSON con `fetch`, así que hace falta un servidor local:

```bash
# desde la raíz del proyecto
python -m http.server 8765
# o con Node: npx serve .
```

Luego abre <http://localhost:8765/>.

> Si abres `index.html` directamente (`file://`), el navegador bloquea el `fetch` y
> `js/store.js` usa automáticamente una copia de respaldo de los mismos datos, para que
> la demo no se rompa. Servida por HTTP, siempre se usan los JSON reales.

## Credenciales del panel (demo)

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador (acceso completo) | `admin@nexora.bike` | `demo1234` |
| Editor (sin Usuarios ni Configuración) | `editor@nexora.bike` | `demo1234` |

Son cuentas ficticias creadas solo para esta demostración. En el panel, la sección
*Configuración → Datos de demostración* permite **restaurar los datos originales**.

## Qué incluye

**Sitio público** (`index.html`)

- Propuesta de valor, proceso de alquiler en 3 pasos y tarifas (hora/día/semana).
- Flota dinámica con filtros por tipo (urbana, eléctrica, montaña) y **reserva funcional**
  mediante modal: valida los datos y crea una reserva en estado *pendiente*.
- Sección de **impacto ambiental** con indicadores calculados a partir de los alquileres
  de la demo, identificados explícitamente como estimaciones simuladas.
- Formulario de contacto que guarda los mensajes, que aparecen en el panel.

**Panel de administración** (`admin.html`)

- Login con sesión (`sessionStorage`) y roles admin/editor (RBAC ligero).
- Resumen con indicadores, reservas recientes e impacto ambiental.
- **CRUD completo** de bicicletas, reservas, usuarios y mensajes, con búsqueda y filtros.
- Ciclo de vida de reservas: *pendiente → confirmada → activa → finalizada/cancelada*.
  Al iniciar un alquiler la bicicleta pasa a “alquilada” y al finalizarlo/cancelarlo se libera.
- Configuración del sitio (nombre, eslogan, contacto, factor CO₂) que se refleja en la web pública.

## Estructura

```
nexora/
├── index.html          # sitio público
├── admin.html          # panel de administración
├── css/
│   ├── style.css       # identidad visual (paleta naturaleza) + componentes compartidos
│   └── admin.css       # maquetación del panel
├── js/
│   ├── store.js        # capa de datos: semillas JSON + persistencia en localStorage + auth
│   ├── script.js       # lógica del sitio público (flota, reservas, contacto, eco)
│   └── admin.js        # lógica del panel (vistas, CRUD, transiciones, roles)
└── data/               # datos de prueba organizados y reutilizables
    ├── bikes.json
    ├── reservations.json
    ├── users.json
    ├── messages.json
    └── settings.json
```

Tecnologías: HTML, CSS y JavaScript vanilla. Sin dependencias ni build (la tipografía
Inter se carga desde Google Fonts; las ilustraciones son SVG originales incluidos en la
propia página, sin imágenes externas).

## Cómo funciona la persistencia

1. Al iniciar, `store.js` intenta cargar `data/*.json`.
2. Cada colección se guarda en `localStorage` (`nexora.demo.v1.*`); los cambios del panel
   o del público persisten entre visitas del mismo navegador.
3. *Restaurar datos de ejemplo* borra las claves y vuelve a cargar los JSON originales.

## Limitaciones (importantes para la presentación)

- **No hay base de datos compartida**: `localStorage` es local a cada navegador, por lo que
  los cambios no se ven entre dispositivos ni usuarios distintos.
- **No hay seguridad real**: la autenticación y los roles son una simulación educativa;
  nunca usar estas credenciales ni este mecanismo en producción.
- Los indicadores ambientales son **estimaciones ilustrativas** generadas con los datos
  simulados de la demo, no estadísticas verificadas.
- En un proyecto real esto se sustituiría por un backend con API, base de datos,
  contraseñas cifradas y control de acceso en servidor.
