# Doces que Vendem

Aplicação independente em TanStack Start, com o app executado na Railway e os serviços de dados e autenticação em um projeto Supabase configurado pelo proprietário. A Railway compila e hospeda o site diretamente; não funciona como proxy para outro site.

## Configuração do Supabase

1. Crie um projeto Supabase próprio.
2. No SQL Editor do projeto, aplique o esquema existente em `drizzle/migrations/0000_migration.sql`.
3. Crie o bucket privado `pdfs` no Storage para os materiais entregues aos compradores.
4. Em Authentication → URL Configuration, configure a URL pública da Railway como Site URL e permita os endereços de retorno usados por `/auth` e `/reset-password`.
5. Se houver dados e usuários na instância anterior, exporte-os e importe-os no novo projeto antes de trocar o tráfego. A aplicação não copia dados entre projetos automaticamente.

Configure estas variáveis no ambiente de execução e de build da Railway:

| Variável | Uso |
| --- | --- |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_DB_URL` | Opcional: conexão PostgreSQL para ferramentas locais; mantenha como segredo |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privada, somente no servidor |
| `VITE_SUPABASE_URL` | URL pública do projeto, usada no bundle do navegador |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública usada no bundle do navegador |
| `SESSION_SECRET` | Segredo aleatório para assinar a sessão administrativa |
| `ADMIN_PASSWORD` | Senha administrativa definida como variável secreta |

Nunca use a chave `service_role` ou senhas em variáveis `VITE_*`, no navegador ou no repositório. O arquivo `.env.example` lista os nomes sem valores reais.

## Railway

Conecte este repositório à Railway e mantenha o builder `Dockerfile` configurado em `railway.json`. Cadastre as variáveis acima também durante o build, pois a URL e a chave pública são incorporadas ao bundle do cliente. A Railway fornece `PORT`; o endpoint `/healthz` é usado pela verificação de saúde.

Depois do deploy:

1. Configure o domínio público da Railway como URL permitida no Supabase Auth.
2. Acesse `/administração`, entre com `ADMIN_PASSWORD` e configure a integração NXGATE.
3. Atualize o endereço do site no painel NXGATE para o domínio público da Railway.
4. Para trocar o fundo da página inicial, abra a aba **Aparência** e informe uma URL HTTPS pública de imagem. Deixe o campo vazio para remover a imagem.

## Desenvolvimento

```sh
bun install
bun run dev
```

Para validar:

```sh
bun run test
bun run build
```
