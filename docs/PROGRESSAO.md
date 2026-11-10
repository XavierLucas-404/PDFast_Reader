# Progressão pessoal — beta

Biblioteca → Progressão → Perfil. Amigos, Ranking e recompensas ficam congelados; implementação anterior preservada no Git e em `archive/social-ui.tsx.txt`. O job `pdfast-close-week` foi desativado no projeto de desenvolvimento. Não há novos pontos ou recompensas no endpoint pessoal.

## O que é contado

Uma palavra é uma posição da extração de um hash de PDF apresentada no modo palavra por palavra, em primeiro plano e com reprodução ativa, entre 100 e 1000 ppm. Ajuste de 25 ppm. Não comprova compreensão. Navegação, prévias, pausa e os dois segundos de transição de capítulo não contam.

Posições já apresentadas não aumentam o total. Uma palavra reconstruída respeita a versão de extração registrada; esta mudança não reindexa documentos. O progresso de um PDF considera as posições únicas entre `readingStart` e o fim. Redefinir o início muda esse intervalo, sem pontuar material pulado.

## Datas e médias

Novas sessões registram instante UTC, dia local e fuso IANA. Um lote é encerrado na mudança de dia/fuso, na pausa ou após 25 apresentações. Visitantes mantêm contagens diárias locais. Contas mantêm fila com dono e ID; somente lotes encerrados são enviados.

Semanas começam segunda-feira no calendário local. O mês é civil. O total usa palavras únicas datadas do período. A média diária divide pelos dias decorridos, incluindo hoje e dias com zero; períodos encerrados usam todos os dias. Dias futuros não entram no divisor. Não existe tarefa diária em segundo plano.

Datas são rótulos do fuso registrado na apresentação e não são reinterpretadas ao viajar. O período atual segue o calendário atual do aparelho. Atribuir datas depende do relógio do aparelho; o servidor rejeita datas futuras além da tolerância de cinco minutos, sem prometer resistência absoluta à manipulação de relógio.

## Legado e sincronização

O histórico anterior é capturado como `undatedSeen`, sem fabricar datas. Aparece separado do gráfico. `presented` continua sendo a fonte única por usuário/hash/posição. `record_activity_baseline` importa somente esse legado sem criar pontos. Leituras novas usam `submit_reading_activity`; uma repetição de ID não reaplica dados. Uma observação datada mais antiga pode corrigir o dia de outra observação datada da mesma palavra. Reler uma posição legada não a transforma em leitura nova.

`reading_progress` retorna totais diários, legado sem data e intervalos de posições confirmadas. A tela acrescenta somente posições novas ainda pendentes e não confirmadas, evitando duplicação otimista. Após sincronizar, o servidor prevalece. PDFs e texto não são enviados. Títulos e estantes continuam sincronizados pelo catálogo privado.

A conta e o visitante têm espaços separados. Respostas de uma conta anterior são ignoradas. Abrir ou atualizar Progressão não publica leituras. Nenhum gráfico antigo é reconstruído artificialmente.


## Validação e ajustes — 2026-11-04

- A apresentação de um cabeçalho reconhecido pode unir visualmente “C H A P T E R 2” em “CHAPTER 2”. As palavras e seus índices continuam intactos; cada posição mantém seu intervalo ativo e sua deduplicação. A pausa extra de dois segundos não conta como atividade. Não houve migração de extração nem mudança do contrato RPC.
- A mensagem de conclusão depende da transição de incompleto para completo, considerando o estado persistido. Reabrir ou reler um PDF concluído não repete o anúncio. Uma mensagem antiga é limpa ao abrir um PDF ou iniciar reprodução.
- Suíte completa: 102 testes aprovados. A integração executa a última palavra, verifica a primeira conclusão e repete a leitura antes/depois de reiniciar, sem novo anúncio. PostgreSQL local cobre isolamento, IDs repetidos, 1000 ppm, datas offline e legado.
- Conferência manual no iPhone 18 Pro / iOS 27.0: semana com 2.354 posições, média 784,7 (três dias decorridos); mês com média 588,5 (quatro dias). Dias sem leitura e futuros ficaram distintos. Outubro encerrado mostrou zero. O gráfico mensal rolou até o dia 30 sem trocar de aba.
- Fronteiras de dia/fuso/DST/mês foram verificadas por automação; virada real de dia e sincronização offline real continuam pendentes. Valores desta conferência são um retrato anterior ao ensaio prolongado e podem aumentar com novas leituras de teste.

Resultados e limites por ID: [validação iOS](VALIDACAO_IOS_2026-11-04.md).

Ensaio nativo concluído: 20 minutos em primeiro plano, 42 amostras com avanço e mesmo processo; 4.544 apresentações ao pausar. Após reiniciar, a releitura do PDF concluído manteve 1.396 posições únicas e não repetiu o anúncio. Atividade a 1.000 ppm foi exercitada e sincronizada. Como outros PDFs também receberam atividade na mesma conta, a deduplicação manual foi comparada por PDF, sem atribuir todo crescimento global ao ensaio.
