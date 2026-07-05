# Vincos & Agulha — Versão 1.0 RC

Inclui:
- Encomendas.
- Número automático de encomenda.
- Estados simples:
  - Recebido do cliente
  - Em produção
  - Pronto para entrega
  - Entregue ao cliente
- Motorista: apenas recebido do cliente / entregue ao cliente.
- Funcionário: regista cliente + número total de peças.
- Cliente: vê estado e histórico.
- Gerente: vê tudo.
- QR Code preparado.
- Botão imprimir etiqueta em papel/PDF.
- Campos preparados para impressora de etiquetas no futuro.

## Antes de publicar
Execute no Supabase:
supabase/schema_v1_rc.sql

## Publicar
Copie os ficheiros para o projeto local e execute:
npm install
git add .
git commit -m "Versao 1 RC encomendas QR"
git push
