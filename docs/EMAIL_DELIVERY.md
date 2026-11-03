# E-mail: diagnóstico e próximos passos

Observação DNS em 2026-11-03: `box.mediaserve.ca` resolve para `173.209.40.129`. A consulta TXT de `box.mediaserve.ca` não retornou SPF. A consulta `_dmarc.box.mediaserve.ca` retornou `v=DMARC1; p=quarantine`. O TXT de `mediaserve.ca` retornou uma verificação Google, não um SPF. Isso não determina sozinho a autenticação da mensagem: o domínio real de envelope e o seletor DKIM precisam dos cabeçalhos recebidos.

Enviar manualmente confirmação, recuperação e mudança de e-mail para Gmail, Outlook e iCloud. Guardar apenas os resultados de Authentication-Results e a pasta de chegada, removendo destinatários, tokens e URLs de ação antes de compartilhar.

| Destino | SPF / domínio envelope | DKIM / d= / selector | DMARC alinhado | Inbox/Spam | Fluxos |
|---|---|---|---|---|---|
| Gmail | pendente | pendente | pendente | pendente | pendente |
| Outlook | pendente | pendente | pendente | pendente | pendente |
| iCloud | pendente | pendente | pendente | pendente | pendente |

Pedir ao administrador: SPF no domínio de envelope usado pelo servidor; assinatura DKIM no domínio remetente e chave pública no seletor correto; alinhamento DMARC; PTR e HELO coerentes; acompanhamento de bounces. Não adicionar um segundo registro SPF; consolidar com o existente. Não mudar DNS de domínio alheio sem administração apropriada.

Templates devem ser simples, remetente reconhecível, links originais do Supabase sem encurtamento/rastreamento e alternativa textual. Revisar a confirmação de troca de endereço em ambos os endereços quando a confirmação dupla estiver ativa. Não declarar sucesso antes da confirmação. A seleção automática de idioma dos e-mails ainda não foi configurada; a localização da interface não altera os templates do Supabase.

Antes de ampliar convidados, adquirir domínio próprio e avaliar manter SMTP ou serviço transacional conforme testes, reputação e custo. Nenhum provedor garante caixa de entrada. Não houve troca de SMTP nem envio externo automático nesta execução.

Fonte: https://supabase.com/docs/guides/auth/auth-smtp
