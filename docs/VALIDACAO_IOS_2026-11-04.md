# Validação iOS — 4 de novembro de 2026

Esta é uma validação técnica local, não uma liberação para TestFlight. O checklist preserva aprovações anteriores do testador e identifica separadamente automação, conferência manual desta execução e pendências. A leitura de 20 minutos e a exclusão real têm registro próprio ao fim deste relatório.

## Ambiente e evidências

- Simulador: iPhone 18 Pro, iOS 27.0, controlado pelo Device Hub.
- Aparelho: iPhone 11 conectado, iOS 26.6.2. Release instalado sem desinstalar; inicialização confirmada por processo. Gestos observados no simulador não foram atribuídos ao aparelho físico.
- Versão: 0.2.0 (2). Bundles desta execução: simulador `ae1eaa060ba1724c2bf12036dc599fdb66ef3bb4e586120cd5808f3eba24baba`; aparelho `f2cf69306cba9f4b590c34b665afe509044ee9bdb6415b94681db1bf9723f588`. Estes hashes identificam o pacote desta execução apesar do número de build mantido.
- Cópias privadas de Documents antes/depois e amostras de estabilidade fora do repositório. Nenhum token, senha ou link de autenticação integra este relatório. As capturas de interface estão no histórico da execução; não foram publicadas nem enviadas a suporte.
- TypeScript, catálogo PT/EN e 102 testes aprovados, incluindo SQL em PostgreSQL local. Nenhuma migração ou alteração de configuração remota foi aplicada.
- Os 98 arquivos do iPhone anteriores à atualização continuaram presentes. PDFs e extrações foram preservados; os snapshots tiveram somente normalização de URI e preenchimento de `originalTitle` equivalente ao título anterior nessa comparação. Leituras posteriores do simulador geram alterações intencionais de atividade e devem ser avaliadas separadamente.

## Resultado dos relatos

| ID | Resultado desta execução | Limite |
|---|---|---|
| B15 | Ausência interna provocada somente para sample.pdf no simulador: app mostrou arquivo ausente e Open PDF desabilitado. Após restaurar o arquivo exato, voltou a ficar disponível. Hash incorreto rejeitado pela automação. | O seletor nativo de recuperação não ficou controlável no Device Hub. Recuperação integral pelo seletor permanece pendente. Apagar o original de Arquivos não remove a cópia interna do app. |
| L09 | IT, página 21: “CHAPTER 2” inteiro observado na pausa e na navegação. Testes cobrem português, romanos, retomada intermediária, cancelamento e fallback ambíguo. | A extração continua com seus índices originais. Cada posição mantém duração e deduplicação; os dois segundos extras não contam. |
| L13 | Em paisagem e fonte de leitura 64, transporte, −25/+25 e A−/A+ estavam visíveis sem rolagem do contêiner essencial. | Texto ampliado do iOS e VoiceOver são verificações distintas, ainda pendentes. |
| L16 | Corrigida a detecção da primeira conclusão e removido reaproveitamento de aviso antigo ao abrir/reproduzir. Integração executa primeira conclusão, releitura e novo lançamento, sem repetir o anúncio. | Releitura da última frase e da última palavra após reinício aprovadas, sem novo anúncio e com 1.396 posições únicas preservadas. |
| C01 | Lista longa rolada por gesto até as últimas frases: Cancelar e Retomar permaneceram no rodapé. Cabeçalhos agora fazem parte da lista, evitando consumir sua altura. | Importação iCloud/offline aprovada pelo testador; fluxo completo de visitante não foi confirmado nesta execução. |

Os modais nativos também passaram a declarar suporte a paisagem. Antes, a rotação física podia deixar o conteúdo do modal em retrato. A correção foi observada no modal de nome, e-mail e senha em orientação horizontal.

## Biblioteca e leitura por ID

`Histórico` significa aprovação anterior do testador preservada, sem alegar repetição manual nesta execução. `Automação` não equivale à aprovação da experiência no aparelho.

| ID | Evidência / classificação |
|---|---|
| B01 | Histórico aprovado (local/iCloud/reinício); importação e persistência cobertas por testes. Seletor do sistema limitado no controle atual. |
| B02 | Histórico aprovado; cancelamentos e preservação cobertos por automação. |
| B03 | Histórico aprovado; limites/extração e erros cobertos por automação. Não repetidos manualmente todos os PDFs inválidos. |
| B04 | Histórico aprovado; hash e deduplicação cobertos por automação. |
| B05 | Histórico aprovado; título e cancelamento cobertos por automação. |
| B06 | Histórico aprovado; operações de estante e destino cobertos por automação. |
| B07 | Histórico aprovado; gestos/destinos cobertos por automação. |
| B08 | Histórico aprovado; inserção e ordem cobertas por automação. |
| B09 | Histórico aprovado; cancelamento de gestos e interrupções cobertos por automação. |
| B10 | Histórico aprovado; salvar/cancelar e reorganização cobertos por automação. |
| B11 | Histórico aprovado; rolagens e gestos cobertos por automação. |
| B12 | Histórico aprovado; capas/metadados e retenção cobertos por automação. |
| B13 | Histórico aprovado; permissões não alteradas nesta execução. Negação real de galeria não repetida. |
| B14 | Histórico aprovado; persistência de preferências coberta por automação. |
| B15 | Esclarecido e manual parcial; ver tabela de relatos. |
| L01 | Histórico aprovado; navegação de páginas e rotação observadas no simulador. Valores inválidos cobertos por automação. |
| L02 | Histórico aprovado; abrir, sair e reiniciar observados, sem conflito. Integração cobre posição persistida. |
| L03 | Continuar da palavra salva exercitado no simulador; integração cobre pertencimento à página. |
| L04 | Retomada de frase exercitada sem redefinir início; regressão automatizada aprovada. |
| L05 | Atualizado: não há mais botão de redefinir início. Retomada preserva o intervalo existente; automação aprovada. |
| L06 | Histórico aprovado; página sem frases deixa Retomar desabilitado nos testes. Não repetida manualmente nesta execução. |
| L07 | Histórico aprovado; ordem preservada, incluindo cabeçalho de IT inspecionado no arquivo extraído. |
| L08 | Histórico aprovado; arquivo do iPhone confirmou Ouço na página 12 e Há na 19; regressões de capitulares aprovadas. |
| L09 | Manual + automação aprovados no simulador; regressão no iPhone 11 ainda precisa de retorno do testador. |
| L10 | Durante play, palavra/área de pausa observadas; toque pausou e trouxe controles. Cobertura automatizada de superfície e interrupção. |
| L11 | Contexto e setas observados; cabeçalho reconhecido também aparece inteiro no contexto. Testes de limites aprovados. |
| L12 | Histórico aprovado; controles de 25 ppm observados; limites 100–1000 cobertos por automação. 1.000 ppm nativo conferido: mais 170 posições e atualização da Progressão. |
| L13 | Manual + automação aprovados para fonte de leitura máxima e paisagem no simulador. |
| L14 | Histórico aprovado; cancelamento de relógio/segundo plano coberto por automação. Home durante play e retorno pausado conferidos; bloqueio real de tela não repetido. |
| L15 | Setas entre palavra/páginas/Biblioteca exercitadas no simulador. |
| L16 | Integração e conferência nativa aprovadas: nenhuma conclusão repetida após reler/reiniciar. |

## Conta, aparência e progressão por ID

| ID | Evidência / classificação |
|---|---|
| C01 | Relato offline preservado; rodapé manual aprovado; visitante completo pendente. |
| C02 | Histórico aprovado; integração de duas instalações e contas/visitante aprovada. Não trocar a conta ativa durante a leitura longa. |
| C03 | Automação de links e autenticação aprovada; cadastro/caixas reais e app fechado pendentes. |
| C04 | Histórico aprovado; sessão persistiu nos reinícios desta execução. Login inválido coberto por automação. |
| C05 | Automação de recuperação aprovada; fluxo real e link expirado/reutilizado pendentes de acesso humano à caixa. |
| C06 | Modal de nome, valor atual, rótulo, cancelamento e paisagem conferidos. Salvamento/duplicidade/erro e troca de conta cobertos por automação. |
| C07 | Endereço atual e alteração pendente permaneceram distintos. Salvar vazio mostrou erro na interface sem alteração. Envio/confirmação real pendente. |
| C08 | Campos protegidos, mínimo de oito caracteres, confirmação, link e Cancelar conferidos. Comprimento/divergência/sucesso cobertos por automação; entrada real de nova senha cabe ao usuário. |
| C09 | Cancelamento da exclusão conferido. Texto corrigido para informar a remoção da biblioteca da conta. Exclusão real depende de confirmação específica. Limpeza compartilhada e isolamento cobertos por testes. |
| C10 | Offline relatado pelo testador; teste completo de modo avião/reconexão ainda pendente. Filas e restauração offline cobertas por automação. |
| C11 | SQL local e integração aprovados para deduplicação. Conferência nativa aprovada para o PDF concluído, mantendo 1.396 posições únicas. |
| C12 | AutoSync, repetição, resposta atrasada e erro cobertos por automação; falha real de rede não foi induzida no Mac. |
| C13 | PT/EN/Sistema e persistência cobertos por automação; EN-US conferido manualmente. Todas as combinações reais ainda pendentes. |
| C14 | Paletas, HEX inválido, restauração e persistência cobertos por automação; comparação visual completa pendente. |
| C15 | Toques nas três abas e gesto no gráfico exercitados; interrupções/toques rápidos/swipes cobertos por automação. Sequência manual completa pendente. |
| C16 | Rótulos e tipos de campos inspecionados. Fonte de leitura não substitui Dynamic Type/VoiceOver: teste completo pendente. |
| C17 | Ensaio contínuo de 20 minutos aprovado no simulador; resultado ao fim. Aquecimento físico não é inferível do simulador. |
| P01 | Histórico aprovado + automação; leitura longa gera atividade intencional para comparação. |
| P02 | Deduplicação coberta por automação e por releitura nativa com 1.396 posições únicas inalteradas. |
| P03 | Navegação sem play não mudou o total observado; testes confirmam ausência de crédito por navegação. |
| P04 | SQL local aceita atividade a 1000 ppm e a inclui nas contagens. Conferência nativa aprovada a 1.000 ppm, com 170 posições novas e gráfico atualizado. |
| P05 | Datas offline e observação mais antiga cobertas por SQL local; fluxo real offline completo pendente. |
| P06 | Médias 784,7 (semana) e 588,5 (mês) conferidas, incluindo zeros e excluindo futuro do divisor. |
| P07 | Semana, mês e outubro encerrado exercitados, incluindo progresso por PDF e zero. |
| P08 | Gesto horizontal levou do início ao dia 30 do gráfico mensal sem sair de Progressão. |
| P09 | Reinício da conta conferido; visitante/trocas cobertos por integração, combinações manuais completas pendentes. |
| P10 | DST, início de semana, mês e fuso cobertos por automação. Virada real de dia permanece pendente. |

## Privacidade e itens externos

- RLS e permissões: nove tabelas inspecionadas sem leitura direta para clientes, funções pessoais com verificação de proprietário, nenhuma execução pública inspecionada permitida a `anon`. Cron competitivo inativo. Avisos do advisor e suas referências estão em [Privacidade do beta](PRIVACIDADE_BETA.md).
- Supabase reportou região us-east-1. Não foram inferidos prazos de backups, subprocessadores ou contratos.
- Proteção contra senhas vazadas está desativada; configuração preservada. Funções privilegiadas intencionais exigem manutenção da validação de dono.
- Catálogo/atividade/diagnósticos inspecionados e testes de filtragem aprovados. Não houve captura independente e descriptografada de tráfego: esse teste continua pendente.
- Sentry sem DSN, sem ativação nativa, replay ou capturas. Crash remoto e simbolicação não foram testados; dependem da configuração deliberada do serviço.
- Archive local concluído, assinatura verificada com `codesign --verify --deep --strict` e dSYM do app presente. Sem upload e sem relatório oficial do Organizer.
- Doze manifests no pacote, todos sintaticamente válidos, sem tracking ou domínios de tracking declarados; sete categorias agregadas incluem as declarações estáticas do SDK Sentry, mesmo com ele inativo. Inventário técnico não equivale à declaração final da loja.
- Conta descartável: exclusão real por último, sem remover outras bibliotecas; guarda de evidências antes da confirmação. Não foram enviadas mensagens ao suporte.
- Responsável legal, países, retenção, política pública PT/EN, App Store Connect, entrega real Gmail/Outlook/iCloud e TestFlight externo permanecem pendentes. Não houve upload, publicação ou alteração de SMTP.

## Ensaio prolongado e fechamento

- Ensaio a 250 ppm em IT: 42 amostras ao longo de 1.205,1 segundos de monitoramento (1.237,4 segundos desde o registro inicial). O mesmo processo esteve presente em todas as amostras, com avanço em todos os intervalos. Monitoramento: posição 6.817 → 11.210; ao pausar, 11.361 e 4.544 apresentações na interface, página 28 e 20 minutos ativos. Controles responderam à pausa.
- RSS amostrado entre 207,7 e 488,6 MiB, com liberação de memória durante o período. Esses valores do simulador não demonstram consumo ou aquecimento no iPhone 11. Nenhum relatório de crash do app foi encontrado no diretório de diagnósticos do Mac.
- A fila permaneceu pequena (uma sessão ativa na última amostra), e ficou vazia após pausar/sincronizar. Home durante reprodução e retorno abriram o leitor pausado.
- Em seguida, o limite de 1.000 ppm foi alcançado; 170 posições novas foram apresentadas e sincronizadas. O gráfico foi atualizado. Também houve crescimento de atividade em outros PDFs da mesma conta durante a execução; não atribuímos toda a diferença global ao ensaio. Consulta de verificação ao servidor mostrou igualdade entre total de linhas e pares únicos hash/posição.
- sample-local-pdf.pdf foi relido até a última palavra, depois o app foi encerrado/reaberto e a última palavra foi reproduzida novamente. Não houve novo aviso de conclusão. Posição 1.402, flag de conclusão verdadeira e 1.396 posições únicas persistiram; fila vazia.
- Exclusão real da conta: pendente de confirmação específica, por último. Credenciais reais, caixas de e-mail, VoiceOver/Dynamic Type completos, modo avião completo e virada real de dia continuam explicitamente pendentes onde indicados.


### Preservação final antes de qualquer exclusão

Nova cópia do iPhone foi comparada com a inicial: 98 arquivos anteriores presentes, nenhum binário alterado, quatro espaços de dados comparados, nenhuma mudança na estrutura de bibliotecas/estantes, nenhuma posição já vista perdida e nenhuma conclusão revertida. Dois documentos tiveram atividade nova durante a execução, mantida na comparação. As cópias pré-exclusão do simulador e do iPhone foram concluídas; a conta ainda não foi excluída.

Ao tentar continuar as verificações de sistema, o simulador ficou na tela de bloqueio; gestos e controle Home não deram acesso à tela inicial. Foi solicitado desbloqueio pelo usuário. Dynamic Type, VoiceOver completo e teclado virtual não foram aprovados sem essa conferência. A exclusão real continua pendente do desbloqueio e da confirmação específica no momento da ação.


## Incidente de abertura no iPhone — perfil de desenvolvimento vencido

Em 4 de novembro, o iPhone recusou iniciar o app com `FBSOpenApplicationErrorDomain / Security`. O perfil incorporado havia vencido em 04/11/2026 às 15:52:22 UTC (11:52:22 em America/Moncton). O Xcode renovou o perfil para validade até 11/11/2026 às 17:06:02 UTC (13:06:02 local); build Release concluído, assinatura validada, certificado efetivo compatível com o perfil, aparelho incluído e entitlements preservados. A atualização foi instalada sem desinstalar.

As cópias imediatamente antes/depois compararam 98 arquivos: nenhum ausente e nenhum conteúdo alterado após normalizar somente revisão e caminho do contêiner. Apesar do perfil renovado, a tentativa de abertura ainda recebeu o erro genérico de segurança do iOS. Verificação de confiança no próprio iPhone foi solicitada; o problema não está registrado como resolvido até a abertura ser confirmada. Não foram removidos dados, certificados nem permissões de proteção.

**Resolvido:** o usuário confirmou que selecionou PDFast Reader como confiável no iPhone e que o aplicativo voltou a abrir. Perfil renovado válido até 11/11/2026 às 13:06:02 (America/Moncton). Não foi necessário alterar o código nem remover a instalação ou seus dados.
