# pm-black-crm

Páginas da Black 2026 da Pague Menos para o CRM. Dois projetos Vite + React independentes, cada um com seus próprios assets, estilos e build (em produção devem virar dois deploys).

| Pasta                 | Página                                                                 | Build publicado             |
| --------------------- | ---------------------------------------------------------------------- | --------------------------- |
| `black-2026-landing/` | Landing de leads: nome, interesses, canais e contato (Salesforce)      | `black-2026-landing/dist/`  |
| `black-2026-cupons/`  | Gamificação de cupons: nome, interesses, gasto e cupons "gerados"      | `black-2026-cupons/dist/`   |

Os `dist/` são versionados para o deploy estático. Depois de alterar qualquer projeto:

```sh
cd black-2026-landing && npm install && npm run build
cd ../black-2026-cupons && npm install && npm test && npm run build
```

Detalhes de cada página (integração, contrato de API, edição dos cupons) estão no README de cada pasta.
