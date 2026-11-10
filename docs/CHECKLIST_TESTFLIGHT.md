# Checklist do beta iPhone / TestFlight

Formato: `ID | build/iOS | passos | esperado | observado | screenshot/vídeo`. Não anexar senhas nem links de autenticação.

## Prioridades

- [x] P0 Git local inicializado; baseline preservado; candidato 0.2.0 (2).
- [ ] P0 Monitoramento: DSN/projeto Sentry, source maps e crash controlado.
- [x] P1 Progressão + 100–1000 ppm + social congelado implementados; validação manual abaixo pendente.
- [ ] P1 Exclusão local/remota e política de privacidade.
- [ ] P1 Validar entrega real Gmail/Outlook/iCloud pelos cabeçalhos.
- [x] P2 Conceito bookworm B escolhido; master e PNG 1024 preparados. Ajuda/feedback implementados. Asset iOS preparado; aparecerá na próxima compilação.
- [ ] P2 Confirmar Developer Program e dados App Store Connect.
- [ ] P3 Upload candidato, revisão beta externa e convidados.

## Resultados manuais

As aprovações anteriores do testador foram preservadas. Automação, conferência manual desta execução e pendências são identificadas separadamente; uma caixa marcada não significa aprovação completa do beta. Consulte [o relatório por ID](VALIDACAO_IOS_2026-11-04.md).

### Biblioteca

- [x] B01 Importar PDF local e do iCloud; abrir e reiniciar. — **Ok**.
- [x] B02 Cancelar importação e escolha de capa. — **Ok**.
- [x] B03 PDF digitalizado/protegido/acima de 30 MB: erro claro sem crash. — **Ok**.
- [x] B04 Reimportar mesmo PDF renomeado: não duplicar progresso. — **Ok**.
- [x] B05 Renomear: acentos, nome longo e cancelamento. — **Ok**.
- [x] B06 Criar/renomear/excluir estante; conferir destino dos livros. — **Ok**.
- [x] B07 Arrastar entre estantes, Sem estante e estante vazia. — **Ok**.
- [x] B08 Inserir no início/meio/fim com divisor separado. — **Ok**.
- [x] B09 Cancelar arraste fora, por rotação e segundo plano. — **Ok**.
- [x] B10 Reorganizar: Salvar, Cancelar e toque externo. — **Ok**.
- [x] B11 Rolagens horizontal/vertical e arraste nas bordas. — **Ok**.
- [x] B12 Capas padrão, páginas arbitrárias/vazias e galeria/recorte. — **Ok**.
- [x] B13 Galeria: negar permissão e cancelar sem perder a capa. — **Ok**.
- [x] B14 Capas/lombadas, títulos longos e preferência após reiniciar. — **Ok**.
- [ ] B15 Arquivo ausente: recuperar somente com o hash correto. — **Parcial manual + automação**. Apagar o original em Arquivos não remove a cópia interna. Ausência interna, abertura bloqueada e restauração verificadas no simulador; rejeição de hash diferente coberta por testes. Seletor nativo de recuperação não ficou controlável pelo Device Hub.

### Leitura

- [x] L01 Páginas: setas, número inválido, teclado e rotação. — **Ok**.
- [x] L02 Ler/fechar/reabrir sem modal de conflito e sem perder posição. — **Ok**.
- [x] L03 Continuar da palavra salva na página correspondente. — **Ok**.
- [x] L04 Retomar frase sem redefinir início. — **Ok**.
- [x] L05 Retomar frase preservando o início e o intervalo de progresso. — **Manual anterior + automação**. A ação independente de redefinir início foi removida da interface.
- [x] L06 Página sem texto: visualizar, sem confirmar frase inexistente. — **Ok**.
- [x] L07 Ordem de extração: títulos, colunas e páginas. — **Ok**.
- [x] L08 Verity: Ouço página 12 e Há página 19. — **Ok**.
- [x] L09 Novo capítulo: pausa de dois segundos, inclusive IT página 21. — **Corrigido; manual no simulador + automação**. Cabeçalho inteiro na apresentação, sem reindexar a extração.
- [x] L10 Play mostra apenas palavra; centro/bordas apenas pausam. — **Ok**.
- [x] L11 Contexto ao pausar e ao usar setas. — **Ok**.
- [x] L12 100, 250, 600 e 1000 ppm; passos de 25. — **Ok**.
- [x] L13 Fonte máxima, nomes longos e paisagem; alcançar controles. — **Corrigido; manual no simulador + automação**. Fonte de leitura 64 e controles sem rolagem; texto ampliado do sistema continua separado em C16.
- [x] L14 Bloqueio/troca de app: retorno pausado. — **Histórico aprovado + manual no simulador**. Home durante play e retorno abriram o leitor pausado; bloqueio de tela não repetido nesta execução.
- [x] L15 Seta retorna ao PDF; PDF retorna à Biblioteca. — **Ok**.
- [x] L16 Concluir PDF curto e reler sem duplicar conclusão. — **Corrigido; integração automatizada aprovada**. Inclui releitura e reinício; fluxo nativo no simulador repetiu a frase final e a última palavra após reiniciar, sem novo aviso e mantendo 1.396 posições únicas.

### Conta e configurações

- [ ] C01 Visitante: importar/ler/reiniciar offline. — **Parcial**. Testador confirmou importação iCloud e leitura offline; papel de visitante não foi confirmado. Rodapé fora da lista verificado no simulador; persistência e isolamento cobertos por automação.
- [x] C02 Visitante/conta A/conta B: isolamento dos dados. — **Ok**.
- [ ] C03 Cadastro/confirmar e-mail com app aberto e fechado. — **Pendente manual**. Links e estados de autenticação cobertos por automação.
- [x] C04 Login inválido, saída e sessão persistida. — **Ok**.
- [ ] C05 Recuperar senha e testar link expirado/reutilizado. — **Pendente manual**. Nenhuma senha nem link de acesso deve ser anexado.
- [ ] C06 Perfil somente leitura; editar/cancelar nome. — **Parcial manual + automação**. Modais, campo preenchido e Cancelar conferidos em paisagem; salvamento com serviço simulado aprovado.
- [ ] C07 Alterar e-mail sem substituir atual antes de confirmar. — **Parcial manual + automação**. Endereço atual e pendente preservados; campo vazio rejeitado na interface. Confirmação real em caixas de e-mail pendente.
- [ ] C08 Abrir modal de senha, validação e salvar. — **Parcial manual + automação**. Campos protegidos, link e Cancelar conferidos; envio real de nova senha requer entrada pelo usuário.
- [ ] C09 Conta descartável: cancelar/confirmar exclusão; outras bibliotecas intactas. — **Parcial**. Cancelar conferido; limpeza e isolamento automatizados. Exclusão real aguarda confirmação específica no momento da ação.
- [ ] C10 Modo avião: ler/pausar/reabrir/reconectar. — **Pendente manual completo**. Leitura offline relatada pelo testador; restauração e filas cobertas por automação.
- [x] C11 Releitura e envios repetidos não duplicam palavras únicas. — **Automação aprovada**. PostgreSQL local, fila e integração; releitura nativa manteve 1.396 posições únicas no PDF de teste.
- [ ] C12 Falha de sincronização: aviso/Tentar novamente/recuperação. — **Automação aprovada; manual pendente**. Sem provocar falha na rede do Mac.
- [ ] C13 Sistema/PT-BR/EN-US, reinício e troca de conta. — **Automação aprovada; manual parcial**. Interface EN-US conferida; demais combinações manuais pendentes.
- [ ] C14 Paletas, HEX inválido, contraste e restaurar padrão. — **Automação aprovada; manual pendente**.
- [ ] C15 Swipe/toque alternados e rápidos nas três abas. — **Automação aprovada; manual parcial**. Navegação por toque e gesto no gráfico conferidos; sequência rápida completa pendente.
- [ ] C16 Texto ampliado do iOS e VoiceOver. — **Pendente manual**. Não confundir com tamanho da palavra do leitor; rótulos acessíveis inspecionados.
- [x] C17 Leitura por 20 minutos: posição, lentidão, aquecimento e crash. — **Aprovado no simulador**. 42 amostras em 1.205,1 segundos, mesmo processo, avanço em todas; interface mostrou 4.544 apresentações e 20 minutos ao pausar. Aquecimento físico permanece pendente.

### Progressão

- [x] P01 Palavras novas aumentam a barra do dia. — **Aprovado pelo testador + automação**. Novas leituras desta execução acompanhadas separadamente.
- [x] P02 Releitura não aumenta total único nem barra. — **Automação + manual no simulador**. As 1.396 posições únicas do PDF concluído permaneceram iguais antes/depois da releitura e reinício; totais globais tinham atividade simultânea em outros PDFs.
- [x] P03 Páginas/frases sem play não contam. — **Manual no simulador + automação**. Navegação entre Perfil e Progressão não mudou o total observado.
- [x] P04 Atividade a 1000 ppm aparece no gráfico. — **Automação + manual no simulador**. Leitura a 1.000 ppm avançou 170 posições novas; gráfico foi atualizado após sincronização.
- [ ] P05 Offline sincronizado depois permanece no dia da leitura. — **Automação aprovada; manual pendente**.
- [x] P06 Zeros e média por dias decorridos, incluindo hoje. — **Manual no simulador + automação**. Semana: 2.354 / 3 = 784,7; mês: 2.354 / 4 = 588,5.
- [x] P07 Semana/mês, períodos anteriores e progresso por PDF. — **Manual no simulador + automação**. Novembro e outubro, incluindo período encerrado com zero.
- [x] P08 Gráfico mensal rola sem trocar de aba. — **Manual no simulador + automação**. Gesto até o dia 30 manteve Progressão selecionada.
- [ ] P09 Reinício, visitante e troca de conta. — **Automação aprovada; manual parcial**. Reinício autenticado conferido; demais combinações manuais pendentes.
- [ ] P10 Virada real de dia; demais fronteiras também automatizadas. — **Automação aprovada; virada real pendente**. Sem modificar relógio do aparelho.

## Critério de liberação

Sem perda de biblioteca/progresso, duplicação de palavras, bloqueio de conta ou crashes recorrentes. Android e loja pública ficam para outro ciclo. TestFlight não está publicado apenas porque o build local funciona.

## Registro técnico desta execução — 2026-11-03

- TypeScript e validação PT/EN: aprovados.
- Suíte completa: 98/98; testes direcionados de sincronização/calendários e limpeza após os ajustes finais também aprovados.
- Migração `20261103180248_personal_reading_activity` aplicada no projeto de desenvolvimento.
- Cron `pdfast-close-week`: inativo, confirmado no servidor.
- Compilação Release 0.2.0 (2): aprovada; instalada e iniciada no iPhone 11. Processo permaneceu ativo na conferência técnica.
- Backup local privado antes/depois; bibliotecas, estantes, títulos, posições, início e histórico preservados. Migração datada realizada para o espaço carregado; outros espaços migram ao entrar.
- Sem APK, sem novo simulador, sem upload para TestFlight. Arrastes, gráficos, acessibilidade e aparência ainda precisam da conferência humana indicada acima.
- Sentry inativo: sem DSN. Upload de símbolos e filtragem de eventos nativos exigem configuração e teste antes de ativação.
- DNS de e-mail inspecionado; testes de entrega/cabeçalhos e ajustes pelo administrador continuam pendentes.


## Relatos originais recebidos — 2026-11-04

Todos foram feitos pelo testador no iPhone 11, iOS 26.6.2:

- **B15:** ao apagar um PDF em Arquivos, esperava que ele deixasse de abrir no app, mas abriu normalmente. Esclarecimento: o app usa sua cópia interna.
- **L09:** “C” aparecia com pausa de dois segundos, seguido de “H”, “A”, “P”, “T”, “E”, “R”, “2”.
- **L13:** o contêiner de tamanho da fonte e −25/+25 parecia ter rolagem desnecessária em paisagem.
- **L16:** após concluir sample-local-pdf.pdf, fechar PDF/app e reler a última página, o aviso “PDF concluído. Você pode reler quando quiser.” reapareceu.
- **C01:** importação pelo iCloud e leitura offline funcionaram; ao chegar ao fim das frases, os botões saíram da tela e não voltaram.

Os relatos permanecem como evidência da versão anterior; aprovação de uma correção em outro dispositivo não substitui a regressão final no iPhone 11.


## Registro técnico desta execução — 2026-11-04

- TypeScript, PT/EN e 102 testes aprovados. Regressões para cabeçalho, conclusão/releitura/reinício, controles fora da rolagem e orientação do modal.
- Release instalado sem desinstalação no iPhone 18 Pro / iOS 27.0 e iPhone 11 / iOS 26.6.2. Inicialização confirmada. Archive local concluído, assinatura validada, símbolos presentes e 12 manifests sintaticamente válidos. Sem upload para TestFlight.
- Ensaio contínuo e releitura aprovados no simulador conforme relatório. Aquecimento e experiência física completa permanecem pendentes.
- Cópias privadas antes/depois e pré-exclusão concluídas. No iPhone, 98 arquivos anteriores preservados; quatro espaços comparados, sem perda de histórico, conclusão ou estrutura de estantes. Alterações de atividade em dois documentos ocorreram durante o teste.
- Supabase inspecionado sem modificar esquema/configuração. Proteção contra senhas vazadas desativada registrada; cron competitivo inativo. Sentry sem DSN, não ativado.
- Exclusão real não realizada: cancelamento validado; confirmação específica ainda necessária. O simulador bloqueado não respondeu aos gestos do Device Hub; desbloqueio solicitado para continuar as verificações de sistema.
- [Relatório completo por ID](VALIDACAO_IOS_2026-11-04.md).


## Incidente de abertura no iPhone — perfil de desenvolvimento vencido

Em 4 de novembro, o iPhone recusou iniciar o app com `FBSOpenApplicationErrorDomain / Security`. O perfil incorporado havia vencido em 04/11/2026 às 15:52:22 UTC (11:52:22 em America/Moncton). O Xcode renovou o perfil para validade até 11/11/2026 às 17:06:02 UTC (13:06:02 local); build Release concluído, assinatura validada, certificado efetivo compatível com o perfil, aparelho incluído e entitlements preservados. A atualização foi instalada sem desinstalar.

As cópias imediatamente antes/depois compararam 98 arquivos: nenhum ausente e nenhum conteúdo alterado após normalizar somente revisão e caminho do contêiner. Apesar do perfil renovado, a tentativa de abertura ainda recebeu o erro genérico de segurança do iOS. Verificação de confiança no próprio iPhone foi solicitada; o problema não está registrado como resolvido até a abertura ser confirmada. Não foram removidos dados, certificados nem permissões de proteção.

**Resolvido:** o usuário confirmou que selecionou PDFast Reader como confiável no iPhone e que o aplicativo voltou a abrir. Perfil renovado válido até 11/11/2026 às 13:06:02 (America/Moncton). Não foi necessário alterar o código nem remover a instalação ou seus dados.
