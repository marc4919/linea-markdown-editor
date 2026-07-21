export const STARTER_MARKDOWN = `# Bienvenido a Línea

Escribe aquí como en un documento y usa la barra superior para dar formato.

Cambia entre **Enriquecido**, **Markdown** y **Comparar/Resultado** cuando quieras. Crea otra nota con **+**.`

export const DOCUMENT_TEMPLATES = [
  {
    id: 'blank',
    name: 'Documento vacío',
    description: 'Empieza desde una página en blanco.',
    filename: 'sin-titulo.md',
    markdown: '',
  },
  {
    id: 'meeting',
    name: 'Notas de reunión',
    description: 'Objetivo, asistentes, decisiones y próximos pasos.',
    filename: 'reunion.md',
    markdown: '# Reunión\n\n**Fecha:** \n**Asistentes:** \n\n## Objetivo\n\n\n## Notas\n\n\n## Decisiones\n\n- \n\n## Próximos pasos\n\n- [ ] ',
  },
  {
    id: 'article',
    name: 'Artículo o ensayo',
    description: 'Una estructura sencilla para desarrollar una idea.',
    filename: 'articulo.md',
    markdown: '# Título\n\nUna introducción breve que presente la idea principal.\n\n## Desarrollo\n\n\n## Conclusión\n\n',
  },
  {
    id: 'journal',
    name: 'Diario',
    description: 'Una pausa breve para registrar el día.',
    filename: 'diario.md',
    markdown: '# Hoy\n\n## Lo que ha ocurrido\n\n\n## Lo que quiero recordar\n\n\n## Mañana\n\n- [ ] ',
  },
  {
    id: 'tasks',
    name: 'Lista de tareas',
    description: 'Prioridades, pendientes y tareas terminadas.',
    filename: 'tareas.md',
    markdown: '# Tareas\n\n## Prioridad\n\n- [ ] \n\n## Después\n\n- [ ] \n\n## Completado\n\n',
  },
  {
    id: 'technical',
    name: 'Documentación técnica',
    description: 'Contexto, decisiones, uso y casos límite.',
    filename: 'documentacion.md',
    markdown: '# Documentación\n\n## Contexto\n\n\n## Decisión\n\n\n## Uso\n\n```\n\n```\n\n## Casos límite\n\n- ',
  },
  {
    id: 'readme',
    name: 'README',
    description: 'Presenta un proyecto y explica cómo utilizarlo.',
    filename: 'README.md',
    markdown: '# Nombre del proyecto\n\nDescripción breve.\n\n## Instalación\n\n```sh\n\n```\n\n## Uso\n\n\n## Licencia\n\n',
  },
  {
    id: 'proposal',
    name: 'Propuesta de proyecto',
    description: 'Problema, alcance, plan y criterios de éxito.',
    filename: 'propuesta.md',
    markdown: '# Propuesta\n\n## Problema\n\n\n## Objetivo\n\n\n## Alcance\n\n### Incluye\n\n- \n\n### No incluye\n\n- \n\n## Plan\n\n1. \n\n## Criterios de éxito\n\n- ',
  },
]
