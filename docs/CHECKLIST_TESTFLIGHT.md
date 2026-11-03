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

Todos os itens abaixo começam **Não testado**. Marcar apenas com feedback real do testador.

### Biblioteca

- [ ] B01 Importar PDF local e do iCloud; abrir e reiniciar. — **Não testado**.
- [ ] B02 Cancelar importação e escolha de capa. — **Não testado**.
- [ ] B03 PDF digitalizado/protegido/acima de 30 MB: erro claro sem crash. — **Não testado**.
- [ ] B04 Reimportar mesmo PDF renomeado: não duplicar progresso. — **Não testado**.
- [ ] B05 Renomear: acentos, nome longo e cancelamento. — **Não testado**.
- [ ] B06 Criar/renomear/excluir estante; conferir destino dos livros. — **Não testado**.
- [ ] B07 Arrastar entre estantes, Sem estante e estante vazia. — **Não testado**.
- [ ] B08 Inserir no início/meio/fim com divisor separado. — **Não testado**.
- [ ] B09 Cancelar arraste fora, por rotação e segundo plano. — **Não testado**.
- [ ] B10 Reorganizar: Salvar, Cancelar e toque externo. — **Não testado**.
- [ ] B11 Rolagens horizontal/vertical e arraste nas bordas. — **Não testado**.
- [ ] B12 Capas padrão, páginas arbitrárias/vazias e galeria/recorte. — **Não testado**.
- [ ] B13 Galeria: negar permissão e cancelar sem perder a capa. — **Não testado**.
- [ ] B14 Capas/lombadas, títulos longos e preferência após reiniciar. — **Não testado**.
- [ ] B15 Arquivo ausente: recuperar somente com o hash correto. — **Não testado**.

### Leitura

- [ ] L01 Páginas: setas, número inválido, teclado e rotação. — **Não testado**.
- [ ] L02 Ler/fechar/reabrir sem modal de conflito e sem perder posição. — **Não testado**.
- [ ] L03 Continuar da palavra salva na página correspondente. — **Não testado**.
- [ ] L04 Retomar frase sem redefinir início. — **Não testado**.
- [ ] L05 Definir início explicitamente e conferir progresso. — **Não testado**.
- [ ] L06 Página sem texto: visualizar, sem confirmar frase inexistente. — **Não testado**.
- [ ] L07 Ordem de extração: títulos, colunas e páginas. — **Não testado**.
- [ ] L08 Verity: Ouço página 12 e Há página 19. — **Não testado**.
- [ ] L09 Novo capítulo: pausa de dois segundos, inclusive IT página 21. — **Não testado**.
- [ ] L10 Play mostra apenas palavra; centro/bordas apenas pausam. — **Não testado**.
- [ ] L11 Contexto ao pausar e ao usar setas. — **Não testado**.
- [ ] L12 100, 250, 600 e 1000 ppm; passos de 25. — **Não testado**.
- [ ] L13 Fonte máxima, nomes longos e paisagem; alcançar controles. — **Não testado**.
- [ ] L14 Bloqueio/troca de app: retorno pausado. — **Não testado**.
- [ ] L15 Seta retorna ao PDF; PDF retorna à Biblioteca. — **Não testado**.
- [ ] L16 Concluir PDF curto e reler sem duplicar conclusão. — **Não testado**.

### Conta e configurações

- [ ] C01 Visitante: importar/ler/reiniciar offline. — **Não testado**.
- [ ] C02 Visitante/conta A/conta B: isolamento dos dados. — **Não testado**.
- [ ] C03 Cadastro/confirmar e-mail com app aberto e fechado. — **Não testado**.
- [ ] C04 Login inválido, saída e sessão persistida. — **Não testado**.
- [ ] C05 Recuperar senha e testar link expirado/reutilizado. — **Não testado**.
- [ ] C06 Perfil somente leitura; editar/cancelar nome. — **Não testado**.
- [ ] C07 Alterar e-mail sem substituir atual antes de confirmar. — **Não testado**.
- [ ] C08 Expandir senha, validação e salvar. — **Não testado**.
- [ ] C09 Conta descartável: cancelar/confirmar exclusão; outras bibliotecas intactas. — **Não testado**.
- [ ] C10 Modo avião: ler/pausar/reabrir/reconectar. — **Não testado**.
- [ ] C11 Releitura e envios repetidos não duplicam palavras únicas. — **Não testado**.
- [ ] C12 Falha de sincronização: aviso/Tentar novamente/recuperação. — **Não testado**.
- [ ] C13 Sistema/PT-BR/EN-US, reinício e troca de conta. — **Não testado**.
- [ ] C14 Paletas, HEX inválido, contraste e restaurar padrão. — **Não testado**.
- [ ] C15 Swipe/toque alternados e rápidos nas três abas. — **Não testado**.
- [ ] C16 Texto ampliado do iOS e VoiceOver. — **Não testado**.
- [ ] C17 Leitura por 20 minutos: posição, lentidão, aquecimento e crash. — **Não testado**.

### Progressão

- [ ] P01 Palavras novas aumentam a barra do dia. — **Não testado**.
- [ ] P02 Releitura não aumenta total único nem barra. — **Não testado**.
- [ ] P03 Páginas/frases sem play não contam. — **Não testado**.
- [ ] P04 Atividade a 1000 ppm aparece no gráfico. — **Não testado**.
- [ ] P05 Offline sincronizado depois permanece no dia da leitura. — **Não testado**.
- [ ] P06 Zeros e média por dias decorridos, incluindo hoje. — **Não testado**.
- [ ] P07 Semana/mês, períodos anteriores e progresso por PDF. — **Não testado**.
- [ ] P08 Gráfico mensal rola sem trocar de aba. — **Não testado**.
- [ ] P09 Reinício, visitante e troca de conta. — **Não testado**.
- [ ] P10 Virada real de dia; demais fronteiras também automatizadas. — **Não testado**.

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
