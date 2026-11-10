# PDFast Reader

Aplicativo Android/iOS em português, feito com React Native, Expo SDK 54 e TypeScript. Leitura de PDFs e texto ficam no dispositivo; Supabase recebe apenas metadados de competição. Esta entrega implementa as etapas de leitura local e competição entre amigos. OCR e rankings globais, mensais e anuais continuam como expansão planejada.

## Executar

Requisitos: Node 22 ou superior e um development build Expo no dispositivo, ou Android Studio/Xcode para compilar localmente.

```sh
npm ci
npm run bundle:pdf
npm start
# Compilação nativa (requer os SDKs da plataforma):
npm run android
npm run ios
```

O HTML de PDF.js já está gerado em `src/pdfHtml.ts`, sem CDN. O script deve ser executado novamente se PDF.js ou o extrator mudar. A biblioteca funciona sem configurar conta ou backend. Para publicação nas lojas, configure assinatura e builds de distribuição; a exportação Metro não gera APK/IPA.

## Configurar competição

1. Crie um projeto Supabase dedicado. Copie `.env.example` para `.env` e preencha a URL e a chave pública anon/publishable; nunca coloque service-role no aplicativo.
2. Execute as migrações `supabase/migrations/001_initial.sql` e `002_reading_start.sql`, nessa ordem, pelo SQL Editor ou Supabase CLI. Em projetos já configurados, aplique apenas a migração 002.
3. Habilite autenticação por e-mail/senha, confirmação de e-mail e uma política de senha com mínimo de oito caracteres. O usuário confirma o e-mail neste dispositivo e o aplicativo abre autenticado; depois escolhe um nome de usuário único. Veja os detalhes abaixo.
4. Habilite Cron/pg_cron e agende o fechamento semanal abaixo, às segundas-feiras 00:00 UTC. A chamada deve ser feita por um contexto administrativo, nunca pelo cliente.

```sql
select cron.schedule(
  'pdfast-close-week', '0 0 * * 1',
  $$select public.close_week(public.utc_week(now()) - interval '7 days');$$
);
```

Verifique `cron.job_run_details` após os fechamentos. Se uma execução falhar, repita `close_week` para a semana perdida, da mais antiga para a mais recente. O fechamento é transacional e idempotente. Para produção, configure alertas de falha do Cron no ambiente de hospedagem.

O projeto Supabase foi conectado em 28/10/2026. As migrações 001 e 002 e o fechamento semanal foram aplicados; a URL e a chave pública estão no `.env` local, fora do versionamento. Em outra instalação sem `.env`, os recursos sociais mostram uma orientação de configuração. O usuário configurou SMTP próprio e confirmou cadastro externo, recuperação e alteração de e-mail; observou entrega frequente em spam.

## Comportamento

- PDFs com texto, até 30 MB e um milhão de palavras. Digitalizações sem texto, PDFs com senha e arquivos incompatíveis recebem mensagem de erro. PDFs com páginas parcialmente digitalizadas precisam ser conferidos no visualizador e na seleção de frases: somente texto extraível é apresentado.
- A extração segue a ordem dos itens de texto de PDF.js. Linhas adicionam pausa; essa aproximação não detecta perfeitamente parágrafos. Colunas e tabelas podem exigir conferência. Não há promessa de reordenação perfeita.
- Palavra pontua após permanecer visível pelo intervalo configurado. Pausa e segundo plano suspendem reprodução. Avançar manualmente não conta como leitura. Todas as posições do início escolhido até o fim precisam ser apresentadas para concluir o documento.
- SHA-256 da representação Base64 canônica dos bytes identifica o arquivo. Renomear/reimportar os mesmos bytes mantém o mesmo identificador. PDFs equivalentes com bytes diferentes não são reconhecidos como duplicados.
- Progresso e fila persistem em snapshots locais alternados após cada palavra; o snapshot anterior permite recuperação após uma gravação interrompida. O texto extraído é gravado separadamente para evitar limites de tamanho do AsyncStorage. Sessões são segmentadas em até 25 palavras e validadas no servidor por limites, duração e posições. A sincronização ocorre automaticamente ao entrar na conta, retornar ao aplicativo e encerrar cada sessão; somente sessões encerradas são enviadas, sem mensagens de sucesso. Falhas geram um aviso discreto fora da reprodução e novas tentativas em 30, 60, 120 e 300 segundos; sessões offline entram na semana do recebimento.
- Releituras nunca duplicam pontuação. Sessões de 650–800 ppm registram apresentação e conclusão, mas não pontuam. Leitura tradicional não pontua nem marca palavras como apresentadas.
- O ranking é pessoal: cada usuário compara seu total com seus amigos aceitos. A composição dos amigos no fechamento define sua recompensa. Isso permite vários vencedores em círculos diferentes, inclusive leitores sem amigos; não existe um único pódio global. Empates usam `rank` (1, 1, 3).
- Top 3 com pontuação positiva ganha medalha e sete dias de tema âmbar. Novas recompensas estendem a validade. Dados e recompensas são acessados por RPCs restritas; tabelas têm RLS e não permitem escrita direta pelo cliente.
- Estatísticas locais representam o dispositivo. Estatísticas de perfil são validadas e vinculadas à conta. A biblioteca e a página de retomada sincronizam por conta entre dispositivos; a palavra exata fica local; o servidor mantém separadamente as posições competitivas para impedir duplicações e determinar conclusão. Reimporte o arquivo para ler em outro dispositivo.
- Ao excluir a conta, o servidor apaga perfil, sessões, amizades, posições e recompensas em cascata. Os PDFs locais permanecem acessíveis. Filas pertencem à conta que iniciou cada sessão e não são transferidas a outro usuário.

## Arquitetura e telas

`App.tsx` contém Biblioteca, Leitor, Amigos, Ranking e Perfil. `src/core.ts` define temporização e período semanal; `src/storage.ts` serializa gravações locais; `src/backend.ts` configura autenticação e RPC. `src/PdfView.tsx` renderiza PDF.js dentro de uma WebView local com CSP sem rede.

O backend aplica unicidade por usuário/hash/posição, autenticação obrigatória e autorização de amizade. Apenas o serviço administrativo pode fechar semanas. O protocolo não contém título, URI ou texto: `submit_session` recebe ID da sessão, hash, total de palavras, posições, velocidade e duração ativa.

React Native reduz manutenção entre plataformas; Expo oferece importação e arquivos locais; PostgreSQL concentra as regras transacionais. Supabase evita operar um servidor dedicado nesta fase, mas seus custos e limites dependem do plano contratado. SDK 54 é a versão fixada e verificada nesta entrega; atualizar o SDK exige uma rodada de compatibilidade e testes nativos.

## Verificação e limitações

```sh
npm run typecheck
npm test
npx expo export --platform android --platform ios
```

Os 77 testes verificam extração de PDFs reais de teste, rejeição de arquivos inválidos e o bundle local do visualizador. Também executam a migração em PostgreSQL embarcado (PGlite), incluindo permissões, duplicidades, amizades, empates, conclusão, exclusão e recompensas. Também verificam fronteiras UTC e temporização. PGlite não substitui a integração com Supabase Auth e Cron reais.

Bundles Android/iOS e análise TypeScript foram verificados. O projeto nativo iOS foi gerado em `ios/PDFastReader.xcworkspace`, com os alvos CocoaPods alinhados ao iOS 15.1 e inicialização por `SceneDelegate` para compatibilidade com Xcode 27 / iOS 27. Importação, WebView, lock screen e acessibilidade ainda precisam de validação completa em dispositivos reais antes de publicação. A extração usa memória proporcional ao PDF; teste arquivos grandes nos aparelhos-alvo.

Checklist manual: importar um PDF simples e um com colunas; verificar abertura direta nas páginas e seleção de frases; alternar modos; pausar, bloquear tela e reabrir; testar 600 e 650 ppm; ler offline e sincronizar duas vezes; usar duas contas para convites; testar reimportação e releitura; verificar tema e exclusão.

A duração é declarada pelo cliente. A validação evita duplicações e incoerências básicas, mas não impede um cliente modificado de fabricar sessões. Não use esta implementação para prêmios financeiros. O texto na interface descreve apresentação de palavras, não compreensão comprovada.

`npm audit` registra 35 avisos transitivos (12 moderados e 23 altos) na cadeia Expo/React Native desta versão, principalmente ferramentas de build. A atualização compatível automática não os resolveu; não foi aplicado downgrade forçado. Revise a atualização do SDK e os avisos antes de publicar.

## Abrir no Xcode

Abra `ios/PDFastReader.xcworkspace` (não o `.xcodeproj`), selecione o scheme PDFastReader e um simulador de iPhone. Para Debug, execute `npm start` em paralelo; para executar sem Metro, altere Run > Build Configuration para Release em Product > Scheme > Edit Scheme.

CocoaPods foi instalado no diretório de gems do usuário. Se `pod` não estiver no PATH, acrescente o diretório retornado por `ruby -e 'puts Gem.user_dir + "/bin"'`. Neste Mac, o Xcode está em Downloads; comandos de terminal podem usar `DEVELOPER_DIR=/Users/lucas/Downloads/Xcode.app/Contents/Developer` sem modificar a configuração global.

O primeiro build pode levar alguns minutos. Para um iPhone físico, selecione seu aparelho conectado no Xcode e configure sua equipe em Signing & Capabilities.

O projeto iOS contém ajustes manuais em `Podfile`, `AppDelegate.swift` e `Info.plist`. Preserve esses ajustes ao regenerar com Expo Prebuild; eles incluem o ciclo de vida UIScene necessário para iOS 27.

## Leitura sem distrações

No modo palavra por palavra, o play inicia a leitura e oculta o cabeçalho, ajustes, estatísticas e barra de status. Um toque em qualquer ponto da tela pausa imediatamente e revela os controles. A palavra permanece centralizada ao pausar e ao girar o aparelho. A reprodução não recomeça automaticamente após retornar do segundo plano. Os controles usam ícones com rótulos acessíveis; ajustes ficam em um painel com rolagem quando necessário.

Retrato e paisagem são permitidos em todo o aplicativo. A configuração está em `app.json` e nas orientações do `Info.plist` nativo; mudanças de orientação exigem novo build. No Android, a configuração será aplicada ao gerar o projeto nativo pelo Expo. Não há alterações no protocolo de sessões ou na pontuação.

## Contexto enquanto pausado

A frase de contexto aparece entre a palavra central e as setas quando o leitor está pausado. Ela começa depois do último `.`, `?` ou `!` anterior à palavra atual. Se o encerramento seguinte estiver de uma a nove palavras à frente, a frase é exibida até esse encerramento; a dez palavras ou mais, mostra somente até a posição atual. Aspas e parênteses após a pontuação são considerados parte do encerramento. Quebras de linha e página não encerram frases. A regra é baseada em pontuação e pode separar abreviações como `Dr.`.

O contexto tem rolagem própria para frases longas e some ao retomar a leitura. Não altera posições, palavras apresentadas ou pontuação. A primeira palavra na abertura inicial não mostra contexto se ainda não houve leitura.

## Escolher o começo do livro

Abra o documento para ir diretamente ao visualizador de páginas, na página da posição salva (ou na página 1 para PDFs novos). Navegue pelo número da página e toque no botão superior **Palavra por palavra**. Selecione uma frase e confirme. O modo palavra por palavra abre pausado na primeira palavra dessa frase. Títulos tipográficos aparecem separados da lista; frases que atravessam páginas têm uma indicação. Páginas sem texto extraível não permitem confirmar. A página do visualizador é independente da posição da leitura, inclusive em páginas vazias.

A porcentagem passa a considerar somente as posições do início escolhido até o fim. O texto anterior continua disponível e palavras puladas não pontuam. É possível redefinir esse início; a conclusão de cada PDF é registrada uma única vez. Na sincronização, `set_reading_start` envia hash, total de palavras e índice inicial antes das sessões. Nenhum texto ou título é enviado.

A extração v2 reconhece capitulares por tamanho e posição, juntando a letra ao primeiro fragmento do parágrafo em casos espacialmente claros. Não usa OCR e mantém casos ambíguos intactos, incluindo possíveis artigos isolados. Títulos são normalizados em Unicode NFC, com reparo conservador de entidades e codificação UTF-8/Latin-1. **Renomear** altera somente o título local e preserva o nome original no dispositivo.

Documentos locais antigos sem sessões pendentes ou histórico marcado como sincronizado são reprocessados automaticamente. Índices e palavras apresentadas são migrados; palavras reconstruídas exigem que todos os fragmentos anteriores tenham sido apresentados. A nova extração é gravada em um arquivo versionado antes do snapshot; a versão anterior é mantida para recuperação. Documentos já sincronizados ou com fila pendente preservam a extração antiga para não reindexar pontuação remota. Esta entrega não altera registros remotos existentes.

Para repetir a checagem das capitulares do PDF de referência, sem incluir o livro no repositório:

```sh
node --import tsx scripts/check-reference.ts /caminho/para/o/livro.pdf
```

A seleção de frases usa pontuação e blocos tipográficos; abreviações e PDFs de layout complexo ainda podem produzir divisões imprecisas.


## Ativar login por e-mail e senha

O código está pronto para integração, mas o serviço remoto não é criado automaticamente. Sem `.env`, Biblioteca e leitura permanecem disponíveis e o Perfil informa que contas ainda não estão configuradas.

1. Em https://supabase.com/dashboard, crie uma organização gratuita e um projeto chamado PDFast Reader. Guarde a senha do banco fora do aplicativo.
2. Em Connect / configurações de API, copie a Project URL e a chave **publishable** (ou a chave legada **anon**). Preencha as duas variáveis de `.env.example` em um arquivo `.env`. Não use chaves secret/service_role. O nome da variável `EXPO_PUBLIC_SUPABASE_ANON_KEY` aceita também a chave publishable.
3. No SQL Editor, execute `supabase/migrations/001_initial.sql` e depois `002_reading_start.sql`. Não execute novamente uma migração já aplicada. Não há nova migração de tabelas nesta entrega: contas são administradas pelo Supabase Auth.
4. Em Authentication, habilite Email, novos cadastros e **Confirm email**, com senha mínima de 8 caracteres.
5. Em Authentication → URL Configuration, use Site URL `com.pdfast.reader://auth/callback`. Adicione estas duas Redirect URLs exatas:
   - `com.pdfast.reader://auth/callback`
   - `com.pdfast.reader://auth/callback?intent=recovery`
6. Mantenha os templates de confirmação e recuperação usando o link padrão `{{ .ConfirmationURL }}`. Não substitua por um link de token direto ao aplicativo: esta implementação utiliza **PKCE** e recebe um `code` após a verificação pelo Supabase. Os links precisam ser abertos na instalação que solicitou o e-mail. Um novo pedido pode invalidar o anterior; envie e abra o último link.
7. Configure Custom SMTP em Authentication com um provedor de envio de e-mails, domínio/remetente verificados e credenciais inseridas **somente no painel Supabase**. Não envie a senha SMTP para o aplicativo. O envio padrão do Supabase só atende endereços autorizados da equipe, tem limite restrito e não serve para disponibilizar cadastro ao público. Desabilite rastreamento de links no provedor para preservar URLs de confirmação.
8. Recompile o aplicativo após preencher `.env`: as variáveis públicas são incluídas no bundle. Reinicie Metro com `npx expo start --clear` no desenvolvimento. Em iOS, instale os Pods após adicionar SecureStore e compile o workspace existente, sem regenerar os ajustes manuais de UIScene.

Referências: [Supabase mobile links](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

### Comportamento de autenticação

- Perfil oferece Entrar, Criar conta, reenviar confirmação e recuperar senha. Cadastro confirmado solicita um nome de usuário único. Campos de senha são limpos após autenticação.
- Sessões e verificadores PKCE usam Keychain/Keystore via Expo SecureStore, em blocos pequenos e com substituição atômica do índice. Uma sessão antiga em AsyncStorage é migrada e removida desse armazenamento após a gravação segura. Não há coleta de senha pelo backend do aplicativo.
- Renovação da sessão acompanha o estado ativo do app. Biblioteca e leitura offline não dependem da renovação. Sair encerra a sessão desta instalação; PDFs e histórico local permanecem no dispositivo. Biblioteca, estantes e histórico local são separados por conta e pelo modo visitante. O snapshot antigo compartilhado é preservado até o usuário escolher explicitamente uma única conta para recebê-lo.
- Pedidos competitivos ficam vinculados ao dono da sessão e usam seu token capturado, evitando atribuição a outra conta durante uma troca. Leituras sem conta não criam sessões competitivas retroativas.
- Recuperação abre o formulário de nova senha, inclusive após reiniciar. Links inválidos/expirados exibem orientação para solicitar outro link. Excluir conta apaga dados remotos por cascata e remove sessões locais pendentes desse usuário, preservando os PDFs.

### Teste de integração após ativação

Em dois usuários de teste: cadastrar, confirmar com app fechado, escolher nomes distintos, testar colisão de nomes, entrar e reiniciar, recuperar senha com app aberto/fechado, repetir link utilizado e verificar erros. Testar leitura offline e sincronização; sair de A e entrar em B não pode enviar as sessões de A para B. Excluir A deve remover seus dados e preservar a biblioteca local. Validar envio real de e-mails e banco remoto antes de disponibilizar contas aos usuários; os testes locais não substituem Supabase Auth e SMTP reais.


### Estado da ativação — 28/10/2026

- Projeto remoto conectado pelo `.env` local, com chave publishable; nenhum segredo administrativo foi incluído no aplicativo.
- Migrações 001/002 executadas em transação e registradas em `supabase_migrations.schema_migrations`.
- Verificação remota: oito tabelas com RLS ativo e SELECT direto negado para anon/authenticated. RPC `my_profile` sem sessão retorna 42501. Security Advisor: zero erros; os 12 avisos de funções SECURITY DEFINER correspondem aos endpoints autenticados intencionais, com `auth.uid()` e controle de dono/amigos. Os auxiliares e o fechamento não podem ser chamados pelos usuários. As sugestões de RLS sem políticas refletem o acesso exclusivamente por RPC.
- Teste transacional no PostgreSQL remoto passou: duas palavras pontuadas, reenvio com zero pontos adicionais e conclusão respeitando o início escolhido. O teste sofreu rollback e não deixou usuário, documento nem pontuação de teste.
- Site URL e dois redirects exatos de confirmação/recuperação configurados. Cadastro por e-mail e confirmação estão ativos; mínimo de senha ajustado para oito caracteres.
- Cron `pdfast-close-week` ativo às segundas-feiras 00:00 UTC. Monitorar `cron.job_run_details` após a primeira execução real.
- Builds Release para iPhone e simulador passaram. Aplicativo conectado instalado no iPhone sem desinstalação, preservando a biblioteca.
- Nota histórica: SMTP estava ausente nesta etapa; posteriormente foi configurado e validado pelo usuário. Para o primeiro teste, usar no app o mesmo e-mail da conta da equipe Supabase, abrir o link no próprio dispositivo e escolher um nome de usuário. Cadastro, confirmação e recuperação reais dependem desse teste e da entrega do e-mail; não foram simulados com uma conta de usuário real nem desativando a confirmação.


Ao compilar o simulador, mantenha assinatura ad hoc (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=8X5URRJX7P`). O projeto declara os entitlements de identificação e do grupo Keychain do próprio aplicativo, também necessários no simulador. O SecureStore precisa desses entitlements para acessar o Keychain; builds sem eles podem exibir “A required entitlement is not present”. O build do iPhone usa assinatura Apple Development.

A inicialização com Supabase ativo foi conferida no simulador após declarar os entitlements de Keychain. A API real também recusou login de uma conta inexistente com `invalid_credentials`.

## Estantes da biblioteca

A Biblioteca apresenta os PDFs como livros com capas estilizadas e cores estáveis por arquivo. Use **Nova estante** para criar categorias e o menu aberto ao tocar na capa ou no título → **Mover para estante** em cada livro para movê-lo. O menu da estante permite renomear ou excluir a categoria; excluir uma estante devolve os PDFs para **Sem estante**, sem apagar arquivos ou progresso. Nomes têm de 1 a 60 caracteres e são únicos sem distinguir maiúsculas ou espaços nas extremidades. “Sem estante” é reservado.

Estantes e vínculos são salvos nos snapshots locais alternados. Instalações anteriores são carregadas automaticamente com os PDFs em **Sem estante**. A organização funciona offline, sem conta no espaço visitante; ao entrar, cada conta tem sua própria estrutura sincronizada entre dispositivos. Reimportar o mesmo PDF abre o documento existente e preserva sua estante.

As telas compartilham a paleta clássica em `src/theme.ts`, com fundo de papel, vinho, dourado, azul acinzentado e marrom. O tema âmbar de recompensa continua disponível. As páginas originais dos PDFs não recebem alterações visuais.

Validação desta atualização: 38 testes automatizados passaram, incluindo persistência e migração das estantes; TypeScript, build Release para simulador iOS e exportação do bundle Android passaram. A interface foi conferida no simulador iPhone 18 Pro em retrato e paisagem, incluindo títulos longos, formulário de estante e modal de renomeação. A validação visual em Android, telas menores, fontes ampliadas e grandes acervos permanece pendente.


### Navegação de páginas e teclado

A tela “Confira a extração” foi removida. O visualizador abre diretamente após a importação, a reimportação de um arquivo existente ou a seleção na Biblioteca. O botão superior “Palavra por palavra” abre a seleção da frase na página visualizada; cancelar preserva a posição anterior e confirmar abre a leitura dinâmica pausada. Não há botão adicional “Começar daqui” no visualizador (essa ação continua na confirmação da frase).

Ao editar o número da página, a área do leitor se ajusta ao teclado e a barra de navegação permanece visível. Os controles superiores são compactados durante a edição; em paisagem, o cabeçalho fica temporariamente oculto. O PDF permanece montado na mesma página, mesmo se sua área visual precisar ser reduzida a zero. O teclado numérico do iOS mantém a ação “Ir para página”.


## Capítulos e extração v3

O leitor avança para a primeira palavra do próximo capítulo e exibe por dois segundos o nome do PDF e “Novo capítulo”, com os controles ocultos. Depois, remove o aviso e inicia a duração normal da palavra, continuando automaticamente. Tocar durante a transição pausa nessa palavra; retomar não repete a espera. A pausa não altera a velocidade configurada, não apresenta palavras adicionais e não entra na duração competitiva enviada ao servidor. Toque, segundo plano e navegação cancelam o temporizador existente; abrir uma posição ou escolher uma frase não introduz espera antes da primeira palavra.

Os marcadores internos com títulos de capítulo são a fonte principal. Sem esses marcadores, títulos explícitos podem marcar capítulos; números isolados precisam de capitular, destaque, espaço antes do texto e sequência consistente. Sumário, créditos, quebras de página, capitulares e títulos grandes não são considerados capítulos por si só. Os índices `chapterStarts` e `chapterDetectionVersion` ficam apenas no snapshot local.

A v3 permite unir uma vogal capitular a um fragmento longo quando a distância é de até 10% da altura do corpo, há candidato único e não há espaço explícito entre os blocos. Os casos com artigos separados e geometria ambígua continuam preservados. No Verity de referência: página 12 forma “Ouço”; página 19 preserva “Há”.

A migração compõe os IDs brutos das extrações v2/v3 para converter índices reais da extração anterior. Não trata IDs v2 como índices brutos. Uma palavra reconstruída só fica apresentada quando todos os fragmentos estavam apresentados; a fila só recebe essa palavra quando todos os fragmentos estão na fila do mesmo dono. A elegibilidade competitiva exige que todos tenham apresentação pontuável. Cada posição é emitida uma vez por dono, preservando IDs, velocidades e durações das sessões restantes.

A RPC autenticada `document_sync_state(p_hash)` informa exclusivamente se o documento do próprio usuário está registrado. Sua implementação privilegiada fica no schema privado; o endpoint público usa SECURITY INVOKER. Aplicar a migração `20261028193353_document_sync_state.sql` após 001/002 em instalações novas; já aplicada neste projeto. Os advisors não adicionaram avisos após essa alteração.

Documentos já registrados preservam a tokenização e a pontuação, recebendo apenas metadados de capítulos. Em casos sem confirmação remota, outra conta responsável pela fila ou falta de conexão, a reindexação é adiada, com histórico e fila preservados. Leitura e sincronização ficam suspensas durante a migração; o arquivo v3 é gravado antes do snapshot. As versões anteriores permanecem para recuperação. Novos PDFs já usam v3.

Diagnóstico local, sem incluir livros no repositório: `node --import tsx scripts/check-chapters.ts /caminho/do/pdf`. Os testes incluem capitulares, marcadores, fallback conservador, migração v2/v3, filas com velocidades e donos diferentes, pausa de capítulo, cancelamento e autorização da nova RPC.


Validação no iPhone em 28/10/2026: Verity migrou para v3 com 35 capítulos; as nove sessões pendentes foram aceitas como 212 posições únicas. Os fragmentos antes separados compõem agora uma palavra. A fila ficou vazia. O arquivo v3 do aparelho confirmou “Ouço” na página física 12 e “Há” na 19. Aquiles permaneceu na extração v2 com 33 marcadores de capítulo e manteve os 91 pontos remotos anteriores. Arquivos, estantes e histórico foram preservados.


## Biblioteca e sincronização automática

Os botões de importar e criar estante usam ícones nativos com rótulos acessíveis. A Biblioteca usa “1 estante” e “1 PDF” no singular. Capa e título abrem o mesmo menu: Abrir PDF, Renomear, Mover para estante e Cancelar. O menu das estantes usa o mesmo modal, preservando a confirmação para excluir.

A sincronização é serializada e não bloqueia a leitura. A sessão ativa continua persistida para recuperação, mas é excluída dos envios até ser encerrada; os IDs existentes são mantidos para idempotência. Tentativas são suspensas em segundo plano, durante recuperação de senha e durante migrações. Trocar de conta descarta os avisos e temporizadores anteriores. O Ranking permite “Atualizar ranking”; o Perfil não expõe operações de sincronização. Os ajustes de velocidade usam passos de 25 ppm.

Validação: 52 testes e TypeScript passaram, incluindo repetição com espera progressiva, concorrência, sessões ativas, isolamento por dono e contagens em português. Menus, mover, renomear, confirmação de exclusão, passos de velocidade e transição de capítulo foram conferidos no simulador em retrato/paisagem com dados temporários, removidos após a validação.


## Biblioteca por conta e arquivos ausentes

A migração `20261029152139_account_library.sql` adiciona catálogo privado por `auth.uid()`, com RLS, RPCs públicas SECURITY INVOKER e implementação no schema privado. Os metadados permitidos são títulos, nomes e IDs de estantes, vínculos, hash, versão/total da extração, página total, posição, início escolhido, intervalos apresentados e conclusão local. PDF, URI local, texto extraído e nomes originais alternativos não são enviados. O catálogo não concede palavras competitivas; essas continuam exclusivamente nas RPCs de sessões. Registros competitivos antigos não viram itens de biblioteca automaticamente.

Os snapshots locais agora usam arquivos separados para visitante e para cada UUID de conta. Originais `pdfast-state-*.json` e arquivos físicos são preservados. Ao entrar, o usuário pode vincular a biblioteca antiga uma única vez à conta exibida no diálogo ou decidir depois. Sessões antigas pendentes são recuperadas somente para o dono original, mesmo que o catálogo seja vinculado a outra conta; não aparecem como PDFs da nova biblioteca nem ganham pontuação retroativa por causa da migração.

Em outro aparelho, a estrutura aparece com “PDF não encontrado neste dispositivo” e “Importar arquivo”. O hash precisa coincidir; v2 e v1 são reproduzidas pela extração compatível, sem mudar os índices já registrados. Arquivos locais podem compartilhar cache físico, mas só aparecem nas bibliotecas vinculadas. O visitante é separado e não importa automaticamente bibliotecas autenticadas.

A sincronização usa revisão otimista e merge de três vias. Não publica um novo marcador apenas por abrir o app. Histórico é unido; a palavra exata permanece local e mudanças concorrentes de página priorizam a página já confirmada no servidor, sem modal de conflito. Uma resposta ou extração antiga não altera o espaço carregado depois de uma troca de conta.

Validação: 61 testes incluindo dois aplicativos com sistemas de arquivos e sessões independentes, migração confirmada, visitante/A/B, resposta atrasada de outra conta, extração concluída após troca de conta, recuperação v2 sem arquivo, biblioteca remota sem conteúdo e ausência de crédito por restaurar metadados. PostgreSQL embarcado verifica permissões, CAS, rejeição de conteúdo, isolamento, índices canônicos e exclusão em cascata. O Supabase foi atualizado e a verificação de segurança não adicionou avisos.

O histórico validado retornado pela RPC é compactado em intervalos pela migração `20261029152920_compact_library_history.sql`, evitando enviar uma lista extensa após cada sessão. Para leitura offline após expiração do token, uma falha de conexão permite recuperar somente a sessão previamente salva no armazenamento seguro; credenciais rejeitadas ou sessão removida não usam esse fallback, e RPCs continuam exigindo a sessão do Supabase.

A conferência visual nativa desta entrega ficou limitada por indisponibilidade da ferramenta de controle do simulador. Os builds Release e os testes de componentes com duas instalações, incluindo troca de conta durante requisições e importações, foram executados.


## Português e inglês

O catálogo único `src/i18n/translations.json` reúne as traduções por função, com `pt` e `en` lado a lado. A função tipada `t("library.importPdf")` resolve as chaves; parâmetros usam `{name}` e contagens usam `one`/`other`, com singular somente para 1. `npm run validate:i18n` verifica ambos os idiomas, formas plurais e igualdade de parâmetros; também é executado pelo TypeScript.

No Perfil, inclusive sem conta, o seletor oferece Sistema, Português e English. A escolha usa a chave local `pdfast.language.preference`, independente de conta, biblioteca e sincronização. Sistema usa português para tags `pt-*` e inglês nos demais casos. Formatação usa pt-BR/en-US, preservando fuso local e semanas UTC. A preferência manual não é alterada ao trocar de conta.

Avisos persistidos em estado usam descritores `{key, params}` e erros próprios usam `AppError`; eles são traduzidos ao exibir, inclusive após trocar de idioma. Erros externos conhecidos são mapeados e detalhes arbitrários do servidor não aparecem como mensagens ao usuário. O visualizador recebe uma mensagem de idioma separada, sem reler o arquivo nem mudar a página. Títulos, texto dos PDFs, nomes de estantes existentes e índices competitivos não são traduzidos.

`expo-localization` 17.0.9 foi instalado pela resolução compatível com Expo SDK54. O projeto iOS declara pt-BR/en e mantém os ajustes de iOS27. As traduções de e-mails do Supabase e páginas externas não fazem parte desta alteração; controles do seletor nativo de arquivos seguem o sistema operacional.

Validação: 66 testes, incluindo troca e persistência de idioma em duas instalações de teste, visitante/contas, plurais, parâmetros, formatos, mensagens estruturadas e ausência de recarregamento do PDF. A ferramenta de conferência visual nativa continuou indisponível nesta entrega.


## Android APK local

O APK standalone fica em `dist/PDFast-Reader-0.1.0.apk`. Instale-o no Android autorizando a instalação pelo navegador ou gerenciador de arquivos. Não requer Expo Go nem Metro.

Para recompilar nesta máquina: `npm run bundle:pdf` e, em `android`, `./gradlew assembleRelease`. Copie `android/app/build/outputs/apk/release/app-release.apk` para o caminho de entrega. O Expo carrega as variáveis públicas do `.env` durante o bundle.

A assinatura própria fica em `.android-signing/release.keystore`, com configuração em `.android-signing/release.properties`, ambos ignorados pelo Git. Preserve essa pasta em backup seguro: atualizações compatíveis precisam da mesma chave. A configuração de SDK local está em `android/local.properties`, também fora do Git.


## Títulos de capítulo com letras espaçadas

A detecção de capítulos v2 normaliza somente o prefixo reconhecido do título, aceitando `C H A P T E R 2` e `C A P Í T U L O 2`, incluindo espaços Unicode. A normalização é usada na análise de títulos e marcadores; não junta palavras do documento nem muda os índices competitivos. Mantém os critérios espaciais existentes e não usa números de subseções como capítulos. PDFs já importados são reanalisados automaticamente pelos metadados de versão; extração e progresso permanecem preservados.

Diagnóstico do arquivo particular `it-by-stephen-king.pdf`: não há outline/marcadores internos. O cabeçalho da página física 21 contém espaços reais entre as letras de CHAPTER. A nova análise identificou 23 capítulos nas 712 páginas, com o capítulo 2 no índice 6806. As 455.236 palavras foram comparadas integralmente com o arquivo extraído do iPhone e permaneceram idênticas. Aquiles continua com 33 capítulos; Verity, 35. A pausa continua ocorrendo somente na passagem automática para um capítulo, sem espera extra ao abrir diretamente uma posição.

Validação: 69 testes, incluindo títulos fragmentados, acentos decompostos, espaços Unicode, prefixos que não são capítulos, subtítulos/subseções, marcadores e preservação das palavras/posição/início/histórico. `scripts/check-chapters.ts` também reconhece o arquivo de referência de Stephen King para diagnóstico local; os PDFs particulares não fazem parte do repositório.


## Áreas seguras no Android

O aplicativo usa `react-native-safe-area-context` (Expo SDK54), com um provider na raiz e medição própria nos modais nativos. As telas respeitam status bar, recortes e navegação do sistema nos quatro lados, sem o antigo deslocamento fixo de status bar. Edge-to-edge continua habilitado.

No leitor dinâmico, o fundo e o toque para pausar ocupam a tela inteira. Cabeçalho/transição usam apenas as bordas superior e laterais; controles usam apenas a inferior e laterais. O contexto reserva a altura da navegação, e a palavra permanece centralizada ao mostrar/ocultar controles. O campo de página mantém o ajuste de altura do teclado no Android e desabilita o editor de texto de tela inteira em paisagem.

Validação desta alteração: TypeScript, catálogo e 71 testes; build Release Android instalado com atualização (`adb install -r`), sem limpar dados; build Release iOS e conferência da Biblioteca em paisagem no simulador. No Android API35, conferidos Biblioteca/Amigos/Ranking/Perfil em modo visitante, importação de PDF de teste, menus, seleção de frase, campo de página, reprodução/pausa e fonte máxima, em retrato/paisagem, com navegação por gestos e três botões e recorte simulado. O Gboard deste emulador reporta a área de teclado mas não desenha suas teclas; a posição do campo foi conferida contra os insets reportados pelo sistema. Layout de anúncio de capítulo também coberto por teste de componente.

APK atualizado: `dist/PDFast-Reader-0.1.0.apk`. Nenhum formato persistido, regra de pontuação ou serviço remoto foi alterado.


## Biblioteca visual, capas e gestos

A Biblioteca mostra somente a capa ou lombada, barra de progresso e eventual aviso de arquivo ausente. Os botões superiores com `+` importam PDFs e criam estantes. Os dois botões seguintes alternam Capas/Lombadas; a preferência `pdfast.library.view` fica no dispositivo e não muda ao trocar de conta. As lombadas usam título girado e cor do modelo, enquanto imagens escolhidas aparecem na vista frontal.

Deslizar horizontalmente troca Biblioteca/Amigos/Ranking/Perfil, sem retorno circular. Rolagem vertical, edição de texto, modais, leitor e gerenciamento de perfil não acionam a troca por gesto. A rolagem de cada aba é restaurada durante a sessão. Segurar um livro por 350 ms permite arrastá-lo para outra posição ou estante; a borda indica inserção e a estante destacada indica o destino. Há rolagem automática nas bordas. Somente uma soltura normal em um destino válido grava a organização. Rotação, segundo plano e cancelamento preservam a ordem. O menu continua oferecendo Mover para estante; a organização por lista fica no menu da estante.

Após importar um PDF novo, a escolha opcional de capa sugere a primeira página. É possível escolher qualquer página, usar o modelo padrão ou selecionar uma imagem da galeria e ajustar seu recorte 2:3. Pular usa o modelo padrão. O menu Alterar capa permite trocar depois. Confirmar a capa de um documento novo abre a página física 1 do visualizador, sem alterar sua posição de leitura dinâmica. Reimportação preserva a escolha anterior.

`libraryOrder` e `coverPage` são metadados privados sincronizados pela revisão existente; valores ausentes têm defaults compatíveis. A migração `20261029180952_library_artwork_order.sql` preserva esses campos quando clientes antigos os omitem. `customCover` é uma referência relativa apenas local, isolada por conta, e nunca entra no catálogo. Imagens são reencodadas em JPEG e copiadas para `pdfast-covers/<conta-ou-guest>/` antes de salvar a escolha; exclusão da conta remove essa pasta. Não há upload de imagem, miniatura ou PDF. Em outro dispositivo, usa-se a última capa padrão/página sincronizada, sem o override da galeria.

O visualizador local gera miniaturas JPEG limitadas a 480 pixels de largura. A Biblioteca usa imagens em cache e somente um renderizador oculto para trabalhos pendentes. Falhas mostram a capa padrão sem apagar a escolha; miniaturas ausentes ou danificadas podem ser regeneradas. A seleção de página e a organização não registram leitura nem pontuação.

Validação: TypeScript, catálogo PT/EN e 77 testes, incluindo recorte, ordem, metadados privados, compatibilidade com clientes antigos, isolamento e cancelamento. Uma regressão cobre explicitamente a diferença de coordenadas Android e movimentos ocorridos enquanto as medições ainda estão pendentes. Migração aplicada e validada no Supabase em transação revertida, sem alterar dados de contas. No Android API35 foram conferidos deslizes entre abas, preservação da rolagem, capas/lombadas, imagem da galeria com recorte, capa de página, importação de Verity, arraste entre estantes, reordenação, destino inválido e reinício. O iOS compilou no simulador e no dispositivo; Biblioteca conferida em paisagem no simulador e atualização instalada no iPhone preservando seus PDFs, posições, histórico, capítulos, estantes e fila. A ferramenta de controle nativo iOS continuou indisponível para percorrer todos os gestos por automação.


## Biblioteca compacta e configurações do leitor

As estantes usam fileiras horizontais em Capas e Lombadas. O menu de cada estante, incluindo Sem estante, oferece Reorganizar: a lista permite arrastar pelo ícone ou usar ações acessíveis, e só Salvar aplica a ordem provisória. Cancelar, voltar ou tocar fora descarta o rascunho. As posições das fileiras são mantidas por conta e modo durante a sessão. O arraste direto mantém rolagem automática vertical e horizontal.

Os diálogos usam AppModal, com cartão, fundo, ações destrutivas e limites de área segura compartilhados. Toques externos cancelam; confirmações nunca são executadas pelo fundo. O paginador de abas acompanha o dedo com páginas adjacentes e mola amortecida, mantendo cabeçalho e navegação fixos. Fileiras horizontais têm prioridade, e edição, leitores, telas internas e modais suspendem esse gesto.

Perfil → Configurações reúne idioma e aparência da leitura palavra por palavra. As paletas gratuitas e as cores livres (seletor HSV/hexadecimal) ficam em `pdfast.reader.colors`, independentes da conta. Controles e barra de status derivam seu contraste do fundo; combinações de palavra/fundo pouco legíveis mostram um aviso. Restaurar padrão recupera as cores originais. Medalhas e registros antigos permanecem, sem bloqueio de aparência por recompensa. A seta do leitor dinâmico encerra a sessão e retorna à página da palavra atual no visualizador tradicional.

Validação: TypeScript, catálogo PT/EN e 82 testes aprovados. Cobertura inclui ordem provisória/cancelamento, persistência por dispositivo e troca de conta, cores inválidas/contraste, diálogos sem confirmação duplicada, retorno às páginas sem contabilização adicional e gestos concorrentes. A conferência visual foi concentrada nos fluxos alterados do Android, em retrato e paisagem. Não houve alterações de backend ou formatos competitivos.

Entrega desta etapa: APK Release atualizado em `dist/PDFast-Reader-0.1.0.apk` e atualização Release instalada/aberta no iPhone 11, sem desinstalar. A comparação dos snapshots do iPhone confirmou bibliotecas, estantes, progresso, histórico e filas idênticos; somente os contadores de revisão do snapshot ativo avançaram na inicialização. A conferência visual foi feita no Android: lista com dois livros arrastada e salva, cancelamento externo, menus, Configurações em retrato/paisagem, leitor personalizado e retorno às páginas, e captura intermediária mostrando duas abas acompanhando o dedo com cabeçalho/navegação fixos. A navegação visual completa no iOS não foi repetida; os gestos do dispositivo físico ainda precisam de conferência manual.

## Indicadores de inserção no espaço entre itens

O arraste usa uma linha independente no espaço entre livros: vertical dourada nas fileiras de capas/lombadas e horizontal vinho na lista Reorganizar. O indicador é absoluto, não recebe toques e não modifica as medidas dos itens durante o arraste. Espaço permanente nas extremidades evita recorte antes do primeiro e depois do último item. Regras de destino, ordem, confirmação e sincronização permanecem as mesmas.

Validação direcionada: TypeScript/catálogo e quatro testes de indicador, reorganização e gestos; inclui início, espaço intermediário, final e remoção ao cancelar. Esta entrega não gera APK nem inicia simuladores; usa atualização incremental do iPhone conectado. A conferência visual do arraste no dispositivo fica para teste manual.

Atualização instalada e aberta no iPhone 11. Comparação dos snapshots confirmou preservação dos dados; somente a revisão e os caminhos absolutos dos PDFs foram atualizados para o novo contêiner iOS. Nenhum APK foi recriado.

## Desaceleração ao soltar as abas

O paginador mantém uma única animação de acomodação por gesto: a atualização React da aba confirma o destino sem reiniciar a mola. A mola usa duração configurada de 400 ms, amortecimento crítico e velocidade inicial zero; a velocidade do gesto tem influência limitada apenas na escolha da página. Toques nas abas e retornos de gestos insuficientes usam o mesmo movimento. Outro gesto interrompe a transição na posição visual atual, sem salto no limiar de ativação. Reduzir Movimento usa transição curta de 100 ms.

Validação direcionada: TypeScript/catálogo e quatro testes de gestos/integração, incluindo confirmação do índice sem segunda animação, soltura lenta/rápida, retorno, interrupção, toque na aba, cancelamento e acessibilidade. Entrega econômica sem APK ou simulador adicional; a percepção visual da suavidade precisa ser conferida manualmente no iPhone.

## Navegação consistente entre abas por toque e gesto

Botões e swipe agora iniciam a acomodação na thread de interface. Solicitações externas têm identificador crescente, inclusive ao tocar na aba já selecionada. A confirmação React de um swipe atualiza somente a seleção, sem iniciar outra animação. Revisões na interface descartam callbacks de gestos superados; a integração também rejeita uma confirmação antiga após um toque mais recente, mesmo antes de o comando desse toque chegar à interface. Um toque durante o arraste cancela o gesto anterior e continua da posição visual atual. A animação de 400 ms, o modo Reduzir Movimento e as regras de rolagem permanecem.

Validação direcionada: TypeScript/catálogo e cinco testes de navegação/integração. O novo teste mantém animações incompletas e filas JS/UI separadas, verifica destinos não adjacentes, alternância toque/swipe, toques rápidos, re-seleção e callbacks atrasados. O controle nativo não reconheceu o aplicativo Simulator nesta sessão, limitando a reprodução visual automatizada dos gestos. Nenhum APK é gerado nesta entrega.

As compilações Release para o simulador iOS e para o iPhone 11 foram concluídas. Atualização instalada sem desinstalar e iniciada em ambos; os oito snapshots do iPhone preservaram seu conteúdo após normalizar somente a revisão e o caminho do contêiner iOS. O teste automatizado também cobre cancelamento de um segundo gesto antes da confirmação do primeiro. A interação visual toque/swipe permanece pendente de conferência manual, pois o controle nativo do Simulator não estava acessível.

## EB Garamond e Perfil

A interface usa os componentes Text/TextInput de `src/Typography.tsx`, sem alterar os componentes globais do React Native. Cinco pesos estáticos locais de EB Garamond (400–800) são carregados via expo-font antes da interface; falhas permitem abertura com a fonte do sistema. Campos, modais, capas padrão e palavra central compartilham essa tipografia. Números destacados das estatísticas e glifos usados como ícones mantêm fonte do sistema. As páginas originais dos PDFs continuam no canvas; apenas os avisos HTML do visualizador usam a fonte incorporada. Os arquivos vieram do pacote @expo-google-fonts/eb-garamond 0.4.3; a licença está em `assets/fonts/OFL.txt`.

No Perfil, o e-mail aparece sob o nome, mantendo tamanho menor; o resumo duplicado de palavras/PDFs foi removido. Configurações e Gerenciar perfil ficam imediatamente antes da explicação sobre troca de dispositivo. Visitantes mantêm Configurações e usuários autenticados mantêm o gerenciamento; carregamento, recuperação e cadastro inicial continuam nos mesmos fluxos.

Validação econômica: TypeScript/catálogo e quatro testes direcionados de tipografia, Perfil, áreas seguras e reorganização aprovados. Testes cobrem fonte local, pesos reais, herança em textos aninhados, edição, fallback, algarismos do sistema, ordem do Perfil e visitante. Build Release concluído e instalado/aberto no iPhone 11; as cinco fontes foram verificadas por hash dentro do pacote. Nenhum APK ou simulador adicional. A conferência visual de textos longos, fonte ampliada e paisagem no iPhone permanece manual, pois o controle nativo não estava disponível.

## Legibilidade e edição separada do perfil

A tipografia compartilhada aumenta em dois pontos os tamanhos explícitos menores que 20, ajustando a altura de linha na mesma proporção. Textos aninhados sem tamanho próprio herdam o aumento já aplicado; ícones/algarismos com `systemFont` e a palavra central com `readability={false}` não recebem o ajuste. Campos sem tamanho explícito usam 19 pontos. Títulos maiores permanecem iguais. Cabeçalho e conteúdo das quatro abas usam 16 pontos laterais, mantendo os 22 verticais, áreas seguras e margens próprias de modais/leitor.

Gerenciar perfil é uma tela de consulta com nome, e-mail atual, alteração pendente e a ação Editar perfil, com ícone nativo. A edição mantém salvamentos independentes para nome/e-mail. Mudar senha expande os campos e as ações de salvar/recuperar; recolher limpa a senha. Sair e Excluir minha conta ficam no fim da edição, mantendo os callbacks e a confirmação de exclusão existentes. Voltar descarta rascunhos; trocar de conta retorna à consulta e desmonta a edição anterior. Nenhuma API ou regra de backend foi alterada.

Validação direcionada: TypeScript, catálogo e seis testes aprovados, incluindo aumento único/herança, tamanhos preservados, margens das abas, edição/cancelamento, senha recolhida, e-mail pendente, salvamentos independentes, envios repetidos e isolamento na troca de conta. Não são feitas alterações em contas reais pelos testes; o serviço é simulado. A conferência visual de teclado, textos longos, paisagem e fonte ampliada permanece manual no iPhone; não há APK nem novo simulador nesta entrega.

Atualização Release instalada e aberta no iPhone 11 sem desinstalação. Os snapshots foram comparados antes/depois, normalizando apenas revisão e caminhos do contêiner. O APK de distribuição permaneceu intacto.

## Configurações compactas

Idioma usa um dropdown inline com Sistema, PT-BR e EN-US. As opções mantêm os identificadores internos e a persistência anteriores; os rótulos acessíveis usam os nomes completos. Na seção palavra por palavra, a prévia e o aviso de contraste vêm antes das paletas. Plano de fundo/Palavras aparecem como linhas com amostra, hexadecimal e seta. Somente um seletor completo fica expandido; recolher descarta o hexadecimal incompleto sem mudar a cor salva. Paletas e Restaurar padrão recolhem os seletores e mantêm aplicação imediata/persistência local. Setas são desenhadas com elementos nativos.

Validação econômica: TypeScript/catálogo e nove testes direcionados aprovados, incluindo idioma/Sistema/persistência, falha ao salvar idioma, ordem da prévia, acordeão exclusivo, hexadecimal inválido, edição visual acessível, atualização da prévia, paletas, contraste e restauração após reiniciar. Nenhum backend, APK ou novo simulador nesta entrega. Teclado, fontes ampliadas e paisagem permanecem sujeitos à conferência visual manual no iPhone.

Build Release instalado e aberto no iPhone 11 sem desinstalação. Comparação dos snapshots antes/depois preservou biblioteca, estantes, progresso e filas após normalizar revisão e caminhos do contêiner iOS. O APK de distribuição não foi recriado.


## Retomada por página, palavra local e histórico independente

`resumePage` é o marcador privado sincronizado (página física, de 1 até pageCount). `position`/`localResumeValid` mantêm a retomada exata deste aparelho, e `legacyPosition` conserva somente o valor antigo de compatibilidade no catálogo. A posição local atual não entra no marcador remoto. Avançar uma página no PDF ou na leitura dinâmica atualiza o marcador; abrir e receber atualizações remotas não reposiciona a tela aberta. Uma página remota alterada desde a base confirmada prevalece sobre alteração concorrente local. Enquanto não houver mudança remota, páginas locais pendentes continuam elegíveis para envio. A confirmação usa o catálogo realmente aceito; avanços durante o envio permanecem diferentes da nova base e são enviados depois.

O seletor “Retomar leitura” oferece Continuar da palavra salva quando ela pertence à página aberta e Retomar daqui para uma frase selecionada. Cancelar e Retomar daqui ficam sempre visíveis no rodapé, fora da lista rolável. Retomar preserva o início definido para o cálculo de progresso/conclusão. Páginas sem texto não permitem confirmar frases. O histórico apresentado é unido por posição, e as tabelas competitivas continuam deduplicando por usuário/hash/posição; retomar/navegar não apresenta nem pontua palavras. Tempo/apresentações da sessão continuam distintos de palavras únicas.

A migração de cada snapshot grava primeiro um backup privado `pdfast-<escopo>-resume-v1-backup.json`, incluindo conflitos antigos, e preserva arquivos de extração e sessões pendentes. Em seguida acrescenta metadados e limpa os conflitos de retomada. Documentos sem arquivo mantêm seus metadados e convertem a posição legada em página somente após reimportação do mesmo arquivo e sequência compatível. PDFs v2/v3 e seus índices permanecem canônicos; não há reprocessamento provocado por esta alteração.

A migração `20261103161650_page_resume_bookmarks.sql` foi aplicada primeiro ao Supabase. Estende apenas a validação do catálogo privado e preserva resumePage quando um cliente antigo a omite, sem reescrever bibliotecas existentes ou alterar pontuação/permissões. Verificação remota confirmou campo aceito, RLS privada habilitada, acesso autenticado e ausência de execução anônima. Os testes de banco verificam isolamento, índices canônicos, páginas inválidas, compatibilidade com clientes antigos e ausência de crédito ao salvar o marcador.

Validação: TypeScript/catálogo e 93 testes verificados (92 na execução completa e o teste de localidade do PDF aprovado isoladamente após atualização de seu mock de tipografia). Inclui reaberturas sem conflito, duas instalações, retomada sem redefinir início, escolha explícita do início, páginas sem texto, migração recuperável, concorrência, resposta atrasada, alteração durante envio e reimportação compatível. Entrega econômica sem APK ou novo simulador; conferência visual dos novos botões no iPhone permanece manual.

Entrega no iPhone 11: uma atualização Release instalada e aberta, preservando os três PDFs da conta ativa, posição local, início escolhido, versões de extração e histórico. Fila permanecia vazia antes/depois. Os três marcadores foram confirmados no catálogo sincronizado e o backup privado da migração foi encontrado no aparelho. Contas/visitante ainda não abertos permanecem intactos e migram de forma preguiçosa ao carregar. Nenhum APK foi gerado.


## Edição de perfil em modais

Editar perfil apresenta nome de usuário, e-mail e alteração de senha em linhas com borda inferior e o mesmo ícone de edição de Gerenciar perfil. Cada ação abre um modal independente com Salvar e Cancelar lado a lado. As regras do nome ficam no placeholder; a senha mantém confirmação e um link discreto de redefinição por e-mail. Cancelar descarta o rascunho; erros preservam os campos; sucesso fecha o modal. Envios repetidos e fechamento durante o salvamento são bloqueados. O aviso de e-mail pendente e as ações Sair e Excluir minha conta permanecem disponíveis.

Validação desta alteração: TypeScript e catálogo PT/EN aprovados; 12 testes direcionados de perfil, integração de contas, diálogos, tipografia, áreas seguras e configurações aprovados. Builds Release concluídos, instalados sem desinstalação e iniciados no simulador iPhone 18 Pro e no iPhone 11 conectado. Os 98 arquivos copiados de Documents do iPhone foram preservados, comparando JSON após normalizar somente revisão e caminho do contêiner. A ferramenta de controle visual não conseguiu acessar o Simulator; teclado, rolagem, textos longos e orientação dos novos modais permanecem pendentes de conferência visual.

## Conferência iOS de 4 de novembro de 2026

O controle visual funciona pelo **Device Hub** do Xcode, identificado por `com.apple.dt.Devices`. O caminho antigo de Simulator.app não existe nesta instalação. A conferência autenticada incluiu modais de perfil em paisagem, cancelamento de exclusão, gráfico semanal/mensal e leitor com fonte máxima.

Cabeçalhos reconhecidos, como “C H A P T E R 2”, agora aparecem inteiros sem mudar os índices da extração ou os tempos contabilizados. O anúncio de conclusão ocorre uma única vez; abrir/reproduzir limpa avisos antigos. Transporte, velocidade e fonte ficam fora da rolagem auxiliar. Os modais declaram suporte a paisagem e os cabeçalhos do seletor de frases rolam dentro da lista, preservando espaço para seu rodapé.

TypeScript, traduções e 102 testes aprovados. Builds Release para simulador/aparelho e Archive local concluídos; assinatura do Archive e presença dos símbolos/manifests verificadas, sem upload. Resultados por ID, ensaio de duração, preservação de dados e pendências estão em [Validação iOS](docs/VALIDACAO_IOS_2026-11-04.md). Os três documentos de beta distinguem testes automáticos, observação manual, feedback anterior e dependências externas.
