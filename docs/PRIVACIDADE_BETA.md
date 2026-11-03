# Privacidade do beta — inventário e plano de publicação

**Rascunho operacional; não é a política pública final.** Faltam identificação do responsável, países do beta, endereço público da política e prazos definidos de retenção. Beta previsto para adultos convidados. Não anunciar conformidade jurídica sem revisão aplicável aos países escolhidos.

| Dados | Local | Finalidade |
|---|---|---|
| PDFs, palavras extraídas, imagens personalizadas | aparelho | leitura, extração e capas; nenhum upload desses conteúdos |
| Hash do PDF, versão da extração, posições apresentadas, início, página | aparelho e Supabase privado | retomada, progresso, deduplicação |
| Título, estantes, ordem, escolha de página da capa | aparelho e Supabase privado | biblioteca entre dispositivos |
| E-mail, usuário, autenticação | Supabase Auth/perfil; sessão no armazenamento seguro | conta e recuperação |
| Sessão: ID, dono, posições, velocidade, duração, instante, dia, fuso | aparelho/fila e Supabase | atividade pessoal idempotente e gráficos |
| Preferências de idioma e cores | aparelho, independentes da conta | personalização |
| Diagnóstico de sincronização | memória, até 50 eventos | operação, código, horário e quantidade; envio por e-mail somente após revisão |
| Crashes | Sentry, apenas se DSN configurado | erro e frames técnicos; sem replay, capturas, payloads ou identidade |
| Feedback enviado pelo usuário | caixa de suporte / Apple | investigar problemas; usuário pode incluir dados espontaneamente |

## Provedores e transparência

- Supabase: autenticação e banco privado, acesso por proprietário. Confirmar região, subprocessadores, backups e acordo de tratamento no painel.
- SMTP atual: `box.mediaserve.ca`; caixa de suporte `pdfastreader@box.mediaserve.ca`. Confirmar com administrador retenção, acesso e localização.
- Apple/TestFlight: distribuição, feedback e relatórios disponibilizados pela Apple segundo seus termos.
- Sentry: integração preparada, inativa sem DSN. Definir região/retenção/acessos antes de ativar; verificar evento fictício e simbolicação. Não há replay nem screenshot.

Títulos de livros e padrões de leitura podem revelar interesses pessoais. Evitar esses valores em logs e tickets. Hashes não tornam dados automaticamente anônimos. Não incluir palavras, PDFs, títulos, e-mails, senhas ou tokens nos diagnósticos automáticos.

## Exclusão e retenção

A exclusão remota usa o fluxo autenticado existente e remove o usuário e dados associados por cascata. Após sucesso remoto, o aplicativo limpa o espaço local e suas capas, remove backups de migração da conta e arquivos hash sem referências em outras bibliotecas/backups. A biblioteca antiga já reivindicada é limpa, preservando sessões pertencentes a outras contas. Arquivos compartilhados fisicamente não devem ser apagados enquanto referenciados por outro espaço. Em snapshot ilegível, a limpeza de órfãos é interrompida para não adivinhar referências; registrar a pendência e permitir suporte.

Sair mantém a biblioteca da conta no aparelho. Excluir conta é diferente de sair. A biblioteca visitante é independente. Remover o aplicativo depende do comportamento de backup do sistema; a política deve explicar isso após definir a estratégia de backup. Backups remotos e mensagens de suporte não desaparecem automaticamente com uma cascata do banco: estabelecer e documentar prazos e processo próprios.

## Antes do TestFlight externo

- [ ] Responsável legal/pessoa, contato e países definidos.
- [ ] Prazos reais para conta ativa/inativa, backups, Sentry e suporte.
- [ ] Testar exclusão completa com duas contas e arquivos compartilhados.
- [ ] Conferir RLS, permissões RPC e isolamento com dados fictícios.
- [ ] Verificar tráfego: nenhum conteúdo de PDF/imagem/extração enviado.
- [ ] Conferir manifests de privacidade e APIs exigidas por cada SDK na distribuição.
- [ ] Política final PT-BR e EN-US publicada em URL estável e ligada em Configurações.
- [ ] Declarações de privacidade do App Store Connect correspondentes à versão final.
- [ ] Permissões limitadas a seleção de documentos/imagens; sem câmera/microfone.
- [ ] Procedimento de acesso/correção/exclusão pelo canal de suporte.

## English policy drafting outline

Identify the controller and contact; describe on-device PDF processing; disclose synchronized titles, shelves and reading metadata; explain account and guest separation, offline queues, unique-word activity and timestamps; name actual processors and regions; explain support/diagnostics choices, retention and deletion including backups; document permissions and user rights; state adult invited beta scope. Publish the reviewed English policy alongside Portuguese after the outstanding facts above are confirmed.

O manifest próprio declara e-mail, identificador de usuário, conteúdo de usuário (títulos/estantes) e interação de produto para funcionamento, vinculados à conta e sem rastreamento. PDFs e imagens locais não são declarados como upload. A agregação final dos SDKs e o relatório do Archive continuam pendentes. Referência: https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests
