# Operação e distribuição

## Erros

O app inclui Sentry 7.2.0 compatível com Expo SDK54. Sem `EXPO_PUBLIC_SENTRY_DSN`, relatórios ficam desativados. Configurar projeto e retenção; DSN é público. Token de upload `SENTRY_AUTH_TOKEN` é segredo de build/CI e nunca deve entrar em EXPO_PUBLIC, Git ou relatório.

**Não ativar apenas preenchendo o DSN.** A callback JavaScript `beforeSend` não cobre sozinha todos os eventos nativos do SDK. Antes da ativação, implementar/verificar a filtragem nativa e testar um crash real, além dos testes unitários de eventos JS. O beta instalado não envia nada porque não há DSN. No código preparado, a ativação nativa também está bloqueada explicitamente (`enableNative: false`) até essa validação; preencher o DSN habilita somente os relatórios JS filtrados. A instalação atual foi compilada sem DSN, antes desse bloqueio adicional para futuras configurações.

O filtro JavaScript usa lista permitida: preserva versão e frames técnicos; descarta valores de exceção, requisições, usuário, breadcrumbs, contextos arbitrários e anexos. Replay, captura de tela e árvore de interface desativados. Testar com strings fictícias sensíveis e verificar no painel **antes de ativar para convidados**. Código nativo e source maps precisam de símbolos para diagnósticos úteis.

Metro já prepara Debug IDs. Ainda falta configurar organização/projeto, etapa autenticada de upload dos source maps e dSYMs da mesma build, e verificar um crash controlado no Sentry/TestFlight. Seguir https://docs.expo.dev/guides/using-sentry/ sem reexecutar prebuild sobre ajustes nativos existentes. Não declarar monitoramento operacional sem esse teste.

Configurações → Ajuda e feedback abre o e-mail com versão. Revisar diagnóstico técnico mostra eventos permitidos em memória; o usuário pode enviá-los no corpo do e-mail. Não é upload automático nem anexo de arquivo. Offline mantém fila; tentativas 30/60/120/300s em primeiro plano. TestFlight complementa com feedback e crashes da Apple.

## Candidato TestFlight

O conceito B foi escolhido; arquivos em `assets/branding`. O ícone da instalação 0.2.0 (2) ainda é o anterior. O asset nativo já contém o PNG 1024; recompilar no próximo candidato para evitar outra instalação apenas por estética.

1. Resolver P0/P1 do CHECKLIST_TESTFLIGHT.md e confirmar que a assinatura Apple Developer Program paga está ativa.
2. Escolher conceito de ícone em `icon-concepts/bookworm-review.png`; produzir ícone final sem cantos arredondados incorporados, gerar assets exigidos e conferir tamanhos.
3. Política pública PT/EN, canal de suporte e contato do responsável.
4. Criar app no App Store Connect, preencher beta description, instruções, contato, login de revisão se necessário e classificação/criptografia conforme uso real.
5. Archive Release com distribuição da equipe correta; conferir versão/build única, símbolos, manifests e assinatura.
6. Um upload por candidato. Primeiro grupo pequeno; convidados externos passam pela revisão beta da Apple.
7. Registrar tag Git, build e resultados. Não publicar com perda de biblioteca/progresso, duplicação ou bloqueio recorrente de conta.

Nenhum upload/TestFlight nem compra/inscrição foi feito automaticamente. Os dados atuais continuam de desenvolvimento. Evitar apontar um beta externo para ambiente que possa ser apagado durante os testes.

Fontes: https://developer.apple.com/testflight/ ; https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/
