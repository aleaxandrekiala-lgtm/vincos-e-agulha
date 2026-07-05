# Vincos & Agulha V2.0

Aplicação online para gestão de produção de engomadoria.

## Inclui

- Login por código e senha.
- Gerente cria clientes.
- Gerente cria funcionários.
- Código de acesso e senha temporária.
- Alteração obrigatória de senha no primeiro acesso.
- Registo de número de peças por cliente.
- Dashboard por cliente e funcionário.
- Histórico.
- Exportação para CSV/Excel.
- Preparada para Vercel.
- Ligação ao Supabase.

## Acesso inicial

Código: `GER001`  
Senha: `123456`

## Supabase

Execute o ficheiro:

`supabase/schema.sql`

## Variáveis na Vercel

Adicionar em Project Settings > Environment Variables:

`VITE_SUPABASE_URL`  
`VITE_SUPABASE_ANON_KEY`

Depois fazer novo deploy.

## Build

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
