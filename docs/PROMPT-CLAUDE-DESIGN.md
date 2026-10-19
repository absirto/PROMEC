# PROMPT PARA O CLAUDE DESIGN — FRONT-END DO PROMEC (ERP MULTI-SEGMENTO COM MOTOR DE CUSTOS)

> Cole tudo abaixo da linha no Claude Design. O prompt é autossuficiente (o Claude Design não enxerga o repositório nem a SPEC): descreve produto, usuários, regras de domínio que a interface precisa respeitar, dados reais de exemplo, identidade visual, temas, componentes e telas. A fonte de verdade do produto é `docs/SPEC-ERP-Promec.md`; se algo aqui conflitar com a SPEC, a SPEC vence. Depois de aprovado o design, a implementação segue em React + Vite + Tailwind.
>
> Identidade aprovada: **Aço & Fagulha** (seção 3). Os tokens exportáveis estão em `docs/design/promec-tokens.css` e `docs/design/tailwind.promec.js`; em caso de divergência de valor de cor, raio ou fonte, esses arquivos valem.

---

## 0. PAPEL

Você é, ao mesmo tempo, **Engenheiro Front-End Sênior** e **Designer de UX/UI Principal** de um ERP industrial multi-segmento. Seu padrão de referência é o rigor da **Apple (Human Interface Guidelines)**: clareza, deferência (a interface recua, o dado manda), profundidade em camadas com **Liquid Glass**, tipografia impecável, respiro, movimento com propósito. Projete o **front-end completo do ProMEC** como protótipo navegável e consistente, com acabamento de prêmio de design (nível Awwwards), mas **antes de tudo utilizável por quem orça, produz e cobra numa oficina mecânica, numa usinagem ou numa caldeiraria**.

O visual precisa **lembrar o chão de fábrica** (torno, solda, paquímetro, engrenagem, desenho técnico), ser **claro, colorido e caloroso**, e **não ter cara de sistema gerado por IA**: nada de gradiente índigo genérico, vidro em tudo, rótulos em caixa-alta espaçada ou textos robóticos. O sistema fala como gente da oficina.

Regra de ouro: **o diferencial do produto é o Motor de Custos.** Toda tela que mostra um preço ou um custo-hora precisa conseguir mostrar, a um clique, de onde ele veio.

## 1. O PRODUTO

**ProMEC — ERP de Gestão e Ordens de Serviço Multi-Segmento com Motor de Precificação por Custos Reais.** Português do Brasil (pt-BR), moeda BRL (`R$ 1.234,56`), datas `dd/mm/aaaa`, horas em decimal (`0,10 h`) e em `hh:mm` (ambos, lado a lado, quando houver espaço), percentuais com uma casa (`14,0%`), números tabulares em toda grade.

### 1.1 Segmentos (um tenant ativa um perfil; a UI liga e desliga campos e templates)

| Perfil | Objeto da OS | Recurso que gera custo-hora | O que a UI precisa mostrar |
|---|---|---|---|
| **OFICINA** (motos e carros) | Veículo (placa, km) | Mecânico, box/elevador, bancada | Checklist de entrada com fotos, peças com margem própria, mão de obra por tempo padrão, garantia, agenda por box |
| **USINAGEM** | Peça ou lote (desenho, revisão, material, tolerância) | Máquina CNC/convencional + operador | Roteiro de operações, setup × ciclo, lote, ferramental específico, inspeção dimensional, certificado de material |
| **CALDEIRARIA** | Projeto/estrutura (lista de materiais em kg) | Soldador/caldeireiro + equipamento (solda, plasma, dobradeira) | Aço por kg, consumíveis, etapas corte → dobra → solda → montagem → pintura, inspeção de solda, montagem em campo |
| **MISTO** | Todos | Todos | Escolhe o template pelo tipo de OS |

### 1.2 Fluxo de negócio que o design precisa deixar óbvio

**Alimentadores** (RH: folha e horas reais · Manutenção: custo por ativo · Financeiro: custo fixo do mês · Estoque: insumos por centro) → **Motor de Custos** (Tabela de Custos versionada; custo-hora cheio e marginal por centro de trabalho) → **Orçamento** (simulador, versões, aprovação digital) → **OS** (roteiro, apontamento real, consumo real, custo real × orçado) → **Financeiro** (contas a receber e a pagar, fluxo de caixa) → **BI** (margem real, ocupação, ponto de equilíbrio).

Apoio à OS: **Planejamento** (agenda e capacidade), **Estoque e Compras**, **Qualidade**. Apoio ao Orçamento: **CRM e Portal do cliente**. A OS devolve horas e custos reais ao Motor de Custos (recalibração): esse **ciclo fechado** deve aparecer na interface, não só no texto.

### 1.3 Navegação lateral (grupos e itens; não inventar módulos fora desta lista)

- **Principal:** Painel
- **Comercial:** Orçamentos · Simulador rápido · Oportunidades · Clientes
- **Operação:** Ordens de Serviço · Planejamento e Agenda · Apontamento (Modo Operador) · Qualidade
- **Custos:** Motor de Custos → Custo fixo · Capacidade · Rateio · Tabela de Custos e versões · Simulador what-if
- **Suprimentos:** Estoque · Compras → Requisições · Cotações · Pedidos · Recebimento
- **Financeiro:** Contas a receber · Contas a pagar · Fluxo de caixa · Comissões · DRE gerencial
- **Ativos e Pessoas:** Centros de trabalho e Equipamentos · Manutenção · Funcionários
- **Cadastros:** Fornecedores · Veículos e Ativos do cliente · Itens (materiais, peças, insumos, ferramentas) · Catálogo de serviços e operações · Centros de custo · Tabelas auxiliares
- **BI:** Painéis → Gestão · Orçamentos · Produção · Comercial · Custos
- **Configurações:** Empresa e Filiais · Perfil de segmento · Usuários e perfis · Parâmetros · Importador (planilha de precificação, CSV/XLSX) · Integrações e webhooks · Auditoria
- **Transversais:** Login, Perfil e troca de senha, Central de notificações, Paleta de comandos (Ctrl/⌘+K), Trilha de auditoria, estados carregando / vazio / erro / sem permissão / offline.
- **Fora do sistema (não desenhar):** emissão de nota fiscal, apuração de impostos, folha de pagamento completa, ponto eletrônico. Impostos aparecem **apenas** como percentual na formação de preço.

### 1.4 Regras de domínio que a interface precisa respeitar

1. **Custo versionado.** Todo orçamento e toda OS exibem a versão da Tabela de Custos usada (badge `Custos 2026-10 · vigente`). Se existir versão mais nova, mostrar aviso não bloqueante com a ação "Recalcular (gera nova versão do orçamento)".
2. **Preço explicável.** Qualquer preço ou custo-hora abre uma **árvore de composição**: material, hora-máquina por centro, setup, mão de obra, terceiros, frete, rateio do custo fixo, impostos, comissão, margem. No portal, o cliente vê só o resumo (material, mão de obra, terceiros): **custo-hora e margem nunca saem do sistema**.
3. **Orçado × Realizado em tudo.** Horas, materiais, terceiros e custo sempre em par (orçado | real | desvio %), com semáforo.
4. **Formação de preço pelo método divisor** (padrão): `preço = custo ÷ (1 − impostos − comissão − margem)`. Desconto recalcula a **margem efetiva** ao vivo; abaixo da margem mínima, semáforo vermelho e ação "Pedir aprovação do gerente".
5. **Setup é por lote, ciclo é por peça.** Alterar a quantidade recalcula o custo unitário e a **curva de lote** (1 · 10 · 50 · 100 peças).
6. **Centro de trabalho é a abstração única**: máquina, box, bancada, célula de solda e técnico em campo. O custo-hora pertence ao centro.
7. **Perfil de segmento** decide campos obrigatórios e visíveis: nunca mostrar placa numa usinagem nem desenho/revisão numa oficina (salvo MISTO, que escolhe por tipo de OS).
8. **Publicar custo é ação consciente.** A Tabela de Custos tem Rascunho → Vigente → Encerrada, mais o aviso **Desatualizada** quando um cadastro que alimenta custo mudou. Publicar exige permissão e confirmação com resumo do impacto (variação por centro, orçamentos abertos afetados).
9. **Permissões granulares**: `ver custo-hora`, `editar margem`, `aprovar desconto acima do limite`, `publicar Tabela de Custos`, `cancelar OS`. Sem permissão, o valor aparece mascarado (`••••`) com tooltip, sem quebrar o layout.
10. **Serviço rápido** sem orçamento só até o limite parametrizado; acima disso, a UI conduz ao orçamento.
11. **Nada se perde.** Orçamento tem rascunho automático; apontamento funciona offline com fila de sincronização visível.

### 1.5 Entidades e campos (use dados realistas no protótipo)

- **Cliente (PF/PJ):** CPF/CNPJ validado, razão social ou nome e fantasia, contatos com papel (financeiro, técnico, aprovador), endereços de cobrança e entrega, condição e forma de pagamento, limite de crédito, margem ou tabela especial, status (ativo / bloqueado por inadimplência); ficha 360° (orçamentos, OS, veículos ou ativos, títulos, margem média).
- **Veículo (oficina):** placa Mercosul ou antiga, chassi, marca/modelo/ano, motor e combustível, km atual (só avança), proprietário, lembrete de revisão. **Ativo do cliente (indústria):** tag, descrição, local, desenhos, peças de reposição.
- **Fornecedor:** PF/PJ, categorias, prazo médio de entrega, condição de pagamento, avaliação, itens fornecidos com último preço e data.
- **Funcionário:** função, vínculo (CLT, PJ, horista, sócio), salário ou valor mensal (visível só para Financeiro e Administrador), % encargos, benefícios, jornada mensal (h), turno, habilitações por centro com validade, % comissão, custo-hora calculado.
- **Centro de trabalho / Equipamento:** tipo (máquina, box/elevador, bancada, célula de solda, equipamento móvel, mão de obra pura), valor de aquisição, data, vida útil (meses), valor residual, manutenção média mensal, insumos médios mensais, potência (kW) e fator de carga, horas disponíveis/mês, eficiência (%), operadores com % de alocação, peso de rateio, status (ativo, em manutenção, desativado); resultados: **custo específico/h, taxa de rateio/h, custo-hora cheio e marginal**, com árvore de composição.
- **Item:** tipo (matéria-prima, peça de reposição, insumo, ferramenta geral, ferramenta específica, produto acabado, serviço externo), unidade de compra e de consumo com fator de conversão, peso por metro ou densidade, custo médio, último custo, estoque mín/máx, rastreável por lote.
- **Operação (catálogo):** nome, segmento, centro padrão, tempo padrão (h), setup padrão (h), fator de dificuldade, origem do tempo ("padrão" ou "média real de 7 OS, desvio 12%").
- **Tabela de Custos (versão):** competência `AAAA-MM`, status, custo fixo total, critério de rateio, horas reais por centro, custo-hora por centro, comparativo com a versão anterior (delta por centro), autor e data de publicação.
- **Orçamento:** nº `ORC-2026-00001`, cliente, template de segmento, objeto, lote, validade, condição de pagamento, vendedor, versão de custos, prazo previsto; blocos de linhas: Materiais e peças · Ferramental específico · Operações (centro, ciclo/peça, setup/lote, custo-hora) · Mão de obra · Terceiros · Frete; totais: custo direto, custo unitário, impostos %, comissão %, margem alvo %, preço, desconto, margem efetiva, margem de contribuição; versões v1, v2…; status **Rascunho · Enviado · Em negociação · Aprovado · Recusado · Expirado · Convertido em OS**; aditivos; aceite digital (nome, IP, hora).
- **Ordem de Serviço:** nº `OS-2026-00001`, tipo (Oficina / Usinagem / Caldeiraria), orçamento de origem e versão de custos, objeto, roteiro de operações (sequência, centro, operador, tempo orçado), apontamentos (setup e produção separados, quantidade boa e refugo, pausas com motivo), consumo de materiais (lote, custo médio), ocorrências, checklist com fotos (oficina), inspeção, entrega (assinatura digital, termo de garantia), **custo real × orçado por linha**; status **Aberta · Em fila · Em execução · Pausada · Controle de qualidade · Concluída · Entregue · Cancelada**; retrabalho como sub-OS.
- **Planejamento:** calendário por centro (turnos, feriados, paradas), carga × capacidade por semana (%), fila por prazo e prioridade, agenda de box e mecânico (oficina), promessa de prazo.
- **Estoque e Compras:** saldos por local (físico, reservado, disponível), movimentações, lotes com certificado, requisições (origem: OS, ponto de pedido, manual), cotações comparativas, pedidos com alçada, recebimento com divergência.
- **Qualidade:** plano de inspeção por tipo de OS, medições (esperado, tolerância mín/máx, medido, resultado), não-conformidades (origem, causa, ação, responsável, prazo), retrabalho, rastreabilidade lote → OS → peça, laudo em PDF.
- **Financeiro:** contas a receber (parcelas, baixa parcial, juros e multa), contas a pagar (categoria, centro de custo, flags "compõe custo fixo" e "custo direto de centro"), recorrências, fluxo de caixa realizado × previsto, comissões, DRE gerencial.
- **Manutenção e RH:** planos preventivos (por calendário ou por horas apontadas), ordens de manutenção, histórico de custo por centro, MTBF e MTTR simples, escalas, ausências, habilitações com validade, produtividade.
- **Usuários e permissões:** Usuário → Perfil → permissões por módulo (`visualizar` / `gerenciar`, gerenciar inclui visualizar) + as permissões sensíveis da regra 9; escopo por filial. Perfis padrão: Administrador, Gerente, Orçamentista, Produção/Técnico, Compras, Financeiro, Recepção.
- **Notificações:** INFO · WARNING · ERROR · SUCCESS, lidas e não lidas, com link. Eventos: orçamento aprovado, OS parada há mais de N h, estouro de horas, estoque mínimo, título vencido, Tabela de Custos desatualizada, prazo em risco.

### 1.6 Dados de exemplo (reais, da planilha de referência; use-os no protótipo)

- Custo fixo mensal **R$ 22.000** · 3 centros produtivos · 220 h/mês · eficiência 75% → 165 h reais → **taxa de rateio R$ 44,44/h**.
- Centro **Torno CNC de entrada**: salário R$ 5.000 + encargos R$ 3.200 + manutenção R$ 700 + insumos R$ 700 + depreciação R$ 2.500 (R$ 150.000 ÷ 60 meses) = R$ 12.100/mês → **custo específico R$ 73,33/h** → **custo-hora cheio R$ 117,78/h**.
- Preço de venda de **1 hora do Torno CNC**: R$ 117,78 ÷ (1 − 14% impostos − 20% margem) = **R$ 178,45** (é o número do simulador da planilha).
- Orçamento **"Bucha de latão com tolerância H7 — lote piloto de 10 peças"** (ORC-2026-00128, Metalúrgica Vale do Itajaí): barra de latão C360 Ø25 a R$ 8,00/peça (45 mm por peça, 4,17 kg/m, R$ 42,00/kg) · ciclo 0,10 h/peça · setup 3,00 h no Torno CNC (R$ 117,78/h) · impostos 14% · margem alvo 20% · comissão 0% → custo do lote **R$ 551,11**, preço **R$ 835,02** (R$ 83,50/peça); com **5% de desconto**, preço **R$ 793,27** (R$ 79,33/peça) e **margem efetiva 16,5%** (entre o mínimo de 15% e o alvo de 20%). Curva de lote (preço por peça, sem desconto): **1 → R$ 565,32 · 10 → R$ 83,50 · 50 → R$ 40,67 · 100 → R$ 35,32**.
- A OS gerada (OS-2026-00041) teve setup real de 3,40 h (+13%), projeção de 4,35 h no total e margem projetada de 11,8%: é o exemplo canônico de orçado × real e de recalibração do tempo padrão.
- Outros nomes plausíveis: Fresa CNC 01, Centro de usinagem 02, Box 3 (elevador), Célula de solda MIG 01, Dobradeira hidráulica; peças "Eixo de transmissão Ø45", "Flange SAE 4\"", "Suporte soldado chapa 3/16"; veículos "Honda CG 160 2022 · ABC1D23", "Fiat Toro 2021 · BRA2E19"; clientes e fornecedores com CNPJ plausível. **Sem lorem ipsum.**

### 1.7 KPIs do Painel e dos painéis de BI

Margem real do mês · Ponto de equilíbrio (R$ e horas) · Ocupação por centro (%) · Custo-hora efetivo × tabelado · Desvio orçado × real (horas, material, margem) · OS por status e atrasadas · Taxa de conversão de orçamentos e motivos de perda · Caixa previsto 30/60/90 dias · Estoque mínimo e itens parados · Custo da não-qualidade · Precisão por orçamentista · Recalibrações pendentes.

## 2. USUÁRIOS E CONTEXTOS DE USO (pense como UX)

| Persona | Dispositivo | Necessidade principal | Implicação de design |
|---|---|---|---|
| **Orçamentista** (persona central) | Desktop, 1–2 monitores | Montar orçamento rápido e defensável; ver a margem efetiva ao mexer em qualquer número | Editor em grade com totais ao vivo, painel lateral fixo "Como chegamos nesse preço", curva de lote, atalhos de teclado |
| **Gestor / dono** | Desktop e celular | Publicar a Tabela de Custos com segurança; margem real; ponto de equilíbrio | Comparativo entre versões, árvore de composição, números grandes, alertas de recalibração |
| **Recepção da oficina** | Desktop e tablet | Receber o veículo, checklist com fotos, agendar, aprovar com o cliente no balcão | Fluxo guiado, câmera, assinatura na tela, agenda por box |
| **Operador / mecânico / soldador** | Tablet fixo ou celular; mãos sujas ou com luva; luz forte; Wi-Fi instável | Iniciar, pausar e encerrar operação; setup × produção; registrar pausa e refugo | **Modo Operador**: alvos ≥ 56px, 1 ação por tela, offline-first com indicador de sincronização |
| **PCP / planejador** | Desktop, 2 monitores | Sequenciar a fila, ver carga × capacidade, prometer prazo | Densidade alta, Gantt simples + kanban + tabela, arrastar e soltar |
| **Inspetor de qualidade** | Tablet com câmera | Medir contra tolerância, fotografar, abrir NC | Medição com semáforo instantâneo, captura de foto, laudo |
| **Comprador / almoxarife** | Desktop e coletor | Requisições, cotações, recebimento com divergência, lotes | Comparativo lado a lado, leitura de QR e lote, alertas de ponto de pedido |
| **Financeiro** | Desktop | Receber, pagar, caixa previsto, classificar despesa como custo fixo | Grades densas, baixa em lote, flags de custo visíveis na linha |
| **Administrador** | Desktop | Perfil de segmento, usuários, parâmetros, importador, auditoria | Matriz de permissões, checagem de impacto ao trocar perfil, diff legível |
| **Cliente (portal)** | Celular | Aprovar orçamento, acompanhar a OS com fotos, 2ª via | Página pública leve, aceite digital, resumo sem custo-hora nem margem |

Princípios de UX: **dado primeiro, decoração depois**; **todo cadastro pode ser feito conversando** (um chat que pergunta uma coisa por vez, consulta CNPJ/CEP/placa e faz as contas) ou pelo formulário tradicional, à escolha da pessoa; no máximo uma ação primária por tela; progressive disclosure (a árvore de composição é o exemplo canônico); feedback imediato; **recálculo ao vivo, nunca um botão "Calcular"**; erros em linguagem humana com como resolver; nunca perder o que o usuário digitou; atalhos para quem usa o dia todo (⌘K, `N` novo, `/` buscar, `Alt+↓` nova linha no orçamento); undo em vez de confirmação, exceto em ações irreversíveis (publicar custo, cancelar OS, entregar), que pedem confirmação com resumo do impacto.

## 3. IDENTIDADE VISUAL — AÇO & FAGULHA

**Conceito: "Aço & Fagulha".** O azul-aço das máquinas, o laranja da fagulha (ferramenta cortando, solda acendendo) e o amarelo da faixa de segurança, sobre um fundo claro e quente de **papel quadriculado de desenho técnico**. A interface é **clara, colorida e calorosa**, tem cara de oficina e não de SaaS genérico. O vidro (Liquid Glass) aparece só no que flutua e sempre sobre algo colorido, para ter o que refratar.

### 3.1 Temas (todos via tokens; troca com transição suave de 300 ms)

1. **Claro (padrão)** — papel quente `#F2EEE7` com quadriculado de 24 px, cartões brancos, sidebar azul-aço em vidro. É a cara do ProMEC.
2. **Escuro** — grafite quente (`#13161B`), laranja mais vivo (`#FF7A2E`) com texto escuro nos botões. Opção, não padrão.
3. **Alto contraste** — preto, branco e cores saturadas (AAA), bordas de 2 px, vidro trocado por superfície opaca, foco amarelo `#FFD400`. Também serve para sol forte no chão de fábrica.
4. **Modo Operador** (densidade aplicável a qualquer tema): alvos ≥ 56 px, fonte +2 níveis, sem hover, ações grandes fixas na base.

Seguir `prefers-color-scheme` por padrão, com seletor manual em cápsula (Claro · Escuro · Alto contraste).

### 3.2 Paleta base (tokens)

| Token | Claro (padrão) | Escuro |
|---|---|---|
| `canvas` (fundo, com quadriculado) | `#F2EEE7` | `#13161B` |
| `base` | `#EAE4DA` | `#181C22` |
| `surface-1` (cartões) | `#FFFFFF` | `#1F242C` |
| `surface-2` (campos, linhas) | `#FBF8F3` | `#252B34` |
| `surface-3` (trilhos, segmentados) | `#F1ECE4` | `#2D343F` |
| `border` / `border-strong` | `#E2DACD` / `#CFC4B3` | `rgba(255,255,255,.08)` / `.16` |
| `text-1` / `text-2` / `text-3` | `#1E1B16` / `#4E473D` / `#6E6557` | `#F4F1EC` / `#C3BCB0` / `#9A9387` |
| `primary` (laranja fagulha: ícones, linhas, destaques) | `#E35D14` | `#FF7A2E` |
| `primary-fill` (botão primário) | `#B8460A` + texto branco (5,4:1) | `#FF7A2E` + texto `#1A0E05` (7,3:1) |
| `primary-soft` / `primary-text` | `#FDE8DA` / `#9A3A06` | `rgba(255,122,46,.16)` / `#FFB07F` |
| `steel` (azul-aço: estrutura, sidebar, faixas) | `#1D4E7A` (+ `#2A6AA3`, `#15395A`) | `#6FA8DC` |
| `signal` (amarelo de sinalização) | `#E0A100` | `#F5B63D` |
| `hero` (faixas de topo) | `linear-gradient(135deg,#2A6AA3,#1D4E7A 45%,#15395A)` | `linear-gradient(135deg,#21476E,#0F2236)` |
| `hazard` (faixa zebrada de aviso) | `repeating-linear-gradient(-45deg,#E0A100 0 10px,#1E1B16 10px 20px)` | igual |

Contrastes conferidos no tema claro: texto 14,8:1 · secundário 7,9:1 · legenda 5,0:1 sobre o papel.

### 3.3 Cores semânticas de status (sempre cor **+ ícone + texto**, nunca só cor)

| Significado | Claro (texto / fundo) | Escuro | Uso |
|---|---|---|---|
| Sucesso | `#0F7A55` / `#DDF3E9` | `#3DD598` | Concluída, Entregue, Aprovado, Vigente, conforme, recebido, pago |
| Atenção | `#8A5300` / `#FCEFC7` (ícone `#E0A100`) | `#F5B83D` | Pausada, Em negociação, Desatualizada, estoque baixo, prazo próximo, margem entre mínimo e alvo |
| Perigo | `#C0352B` / `#FBE2DF` | `#FF6B5E` | Cancelada, Recusado, não conforme, atrasada, margem abaixo do mínimo, título vencido, despesa |
| Informação | `#1A64A8` / `#E0EDFA` | `#5AB0F0` | Em fila, Enviado, Controle de qualidade, nova notificação |
| Em andamento | `#5B3FB5` / `#ECE6FB` | `#A891FF` | Em execução, Convertido em OS |
| Neutro | `#6B6458` / `#ECE7DF` | `#ABA396` | Aberta, Rascunho, Expirado, Encerrada, arquivado |

Mapeamentos fixos:
- **OS:** Aberta = Neutro (círculo tracejado) · Em fila = Informação · Em execução = Em andamento (ponto pulsando) · Pausada = Atenção · Controle de qualidade = Informação (ícone de paquímetro) · Concluída = Sucesso (contorno) · Entregue = Sucesso (sólido) · Cancelada = Perigo (riscado).
- **Orçamento:** Rascunho = Neutro · Enviado = Informação · Em negociação = Atenção · Aprovado = Sucesso · Recusado = Perigo · Expirado = Neutro riscado · Convertido em OS = Em andamento.
- **Tabela de Custos:** Rascunho = Neutro · Vigente = Sucesso · Encerrada = Neutro atenuado · **Desatualizada** = ponto amarelo sobre o selo Vigente.
- **Margem efetiva:** ≥ alvo = Sucesso · entre mínimo e alvo = Atenção · < mínimo = Perigo. A régua de margem é vermelha até o mínimo, amarela até o alvo e verde depois.
- **Orçado × real:** dentro da tolerância = Sucesso · até 2× a tolerância = Atenção · acima = Perigo. Orçado em barra cinza, real em barra colorida.
- **Dinheiro:** receita verde com `+`, despesa vermelha com `−`.

### 3.4 Cores de dados e composição de custo

Ordem e cor fixas da composição em todo o produto: **material `#1D6FB8` → hora-máquina `#0F9D76` → setup `#E0A100` → mão de obra `#1D6FB8` → rateio do custo fixo `#7C5CC4` → impostos `#8C8476` → margem `#E35D14`**. No custo-hora: mão de obra azul, manutenção verde, insumos amarelo, depreciação violeta, energia neutra, rateio laranja. **Orçado sempre cinza `#A3AEC0`, real sempre azul-aço `#1D4E7A`**. Cada linha de custo e cada tipo de centro tem um **chip colorido com ícone** (34 px, raio 11). Rótulos diretos, grade fina, tooltips ricos.

### 3.5 Tipografia

- **Títulos: Barlow Semi Condensed** 600–700 (desenho de placa de sinalização de fábrica).
- **Texto: IBM Plex Sans** 400–600 (herança de engenharia, ótima para ler o dia inteiro).
- **Números, códigos, horas e medidas: IBM Plex Mono** com `tabular-nums` (`OS-2026-00041`, `0,10 h`, `Ø20 H7`).
- Escala: Display 40–62 / Título 1 46 / Título 2 26 / Seção 17 semibold / Texto 15 / Apoio 14 / Legenda 12,5. Corpo nunca abaixo de 14 px (17 px no Modo Operador).
- Números de KPI 40–52 px, peso 700, animados na entrada. O **preço final** do orçamento é o maior número da tela.
- **Não usar Inter, Roboto ou Arial.** Nada de rótulos em CAIXA-ALTA espaçada: seções em frase normal, com um traço laranja curto antes quando precisar de sobretítulo.

### 3.6 Forma, profundidade e vidro (Liquid Glass)

- Cantos: 12 (controles pequenos) / 14 (campos) / 22 (cartões) / 30 (painéis e faixas) / 28 (sheets mobile) / cápsula 999 (botões, segmentados, topbar, filtros).
- **Botões em cápsula**; primário laranja com brilho interno no topo e sombra laranja suave; **uma ação laranja por tela**.
- **Liquid Glass** (padrão Apple): fundo translúcido `rgba(255,255,255,.62)`, `backdrop-filter: blur(24px) saturate(1.8)`, borda branca 1 px, brilho especular no topo (`inset 0 1px 0`) e um reflexo em gradiente sobreposto. Variante escura `rgba(255,255,255,.14)` para usar sobre as faixas azuis.
- **Onde vai vidro:** sidebar azul-aço flutuante (descolada 12 px da borda, raio 26), topbar em cápsula flutuante, cartões de KPI sobre a faixa do topo, painel lateral "Como chegamos nesse preço" (sempre sobre uma placa laranja→azul com engrenagens, para o vidro ter cor por trás), sheets, modais, paleta ⌘K, barra de abas do celular. **No máximo 2 camadas de vidro empilhadas.**
- **Onde não vai vidro:** grades, tabelas, formulários longos e texto corrido ficam em cartão branco sólido.
- Refração real (`feDisplacementMap`) só em 1–2 peças de destaque (login); no resto, vidro CSS. Fallback sólido sem `backdrop-filter`; Alto contraste e "reduzir transparência" trocam vidro por superfície opaca.
- Fundo do app: papel quente com **quadriculado de 24 px** (desenho técnico). Faixas de topo (hero) em gradiente azul-aço com ilustração de processo em traço branco translúcido.

### 3.7 Ilustração e iconografia de chão de fábrica

- **Ilustrações de processo em traço de prancheta** (2–2,4 px, cantos arredondados), em branco translúcido sobre as faixas azuis ou em azul-aço sobre o papel: **torno** (cabeçote, placa, peça, contraponto, carro porta-ferramenta), **solda MIG** (tocha, cordão sobre chapas, fagulhas), **paquímetro** com escala, **engrenagens** (girando bem devagar), **dobradeira**, **elevador de oficina com moto**, **prateleira de almoxarifado**, **caminhão de entrega**.
- O **laranja aparece só onde há calor ou corte**: ponta da ferramenta, cavaco, arco da solda, fagulhas (que piscam suavemente).
- **Desenho técnico da peça** no orçamento e no portal: vista em corte com hachura, linha de centro traço-ponto, cotas (Ø25, 42, Ø20 H7 em laranja) e carimbo (`BUC-H7-020 · rev. C · latão C360 · 2:1`).
- **Placa Mercosul** desenhada (faixa azul "BRASIL") em veículo, recepção e OS de oficina.
- **Faixa zebrada amarela e preta** no topo de avisos importantes e confirmações irreversíveis.
- Cada tela tem sua faixa de topo com a ilustração do próprio processo (lote/paquímetro na Qualidade, prateleira no Estoque, caminhão em Compras, gráfico em Financeiro).
- Ícones de traço 1,75 px (família Lucide). **Sem emojis.** Estados vazios com a mesma ilustração em traço + chamada para ação.

### 3.8 Voz e tom (faz parte da identidade)

- **Chame a pessoa pelo nome** e fale como gente da oficina: "Bom dia, Marina." · "Boa, Paulo! A margem está no alvo."
- **Explique o porquê e diga o próximo passo**, nunca só o erro. Exemplos:
  - Evitar "Erro: valor inválido." → "Nenhuma máquina roda 100% do tempo. Que tal 75,0%, a média do seu apontamento?"
  - Evitar "Operação concluída com sucesso." → "Pronto! O orçamento foi para a Metalúrgica Vale. Quando eles abrirem, você fica sabendo."
  - Evitar "Nenhum registro encontrado." → "Nenhum ferramental por aqui ainda. Se a peça pede um alargador especial, é só adicionar."
  - Evitar "Margem abaixo do limite parametrizado." → "A margem ficou apertada: 12,0%. Peça um ok à Marina antes de enviar."
- Tranquilize quando algo não muda ainda ("Fica tranquila: os orçamentos seguem com R$ 117,78/h até você publicar").
- Nada de "Erro 422", jargão de sistema ou tom de robô.

## 4. MOVIMENTO E ANIMAÇÕES COM SCROLL

- Curva padrão tipo mola (`cubic-bezier(0.2, 0.8, 0.2, 1)`), 200–450 ms; nada piscando nem bloqueando tarefa.
- **Scroll (obrigatório):** revelação escalonada (fade + translateY + leve blur) de cards, KPIs e linhas; **large title que encolhe para título compacto** na topbar de vidro conforme rola; contadores de KPI animados do 0 ao valor; gráficos que se desenham ao entrar; **linha do tempo da OS que se desenha com o scroll**; **árvore de composição de custo que expande em cascata**; seções sticky com progresso (o painel de totais do orçamento é sticky); paralaxe sutil de fundo.
- Movimento de chão de fábrica, sempre discreto: engrenagens das ilustrações girando muito devagar (40–60 s por volta), fagulhas e cavaco piscando suave, peças do login flutuando com paralaxe leve, ponto pulsando em "Em execução" e "Na máquina agora".
- Micro-interações: botões com press-scale, hover com elevação de 1–2 px, ripple de luz no vidro, toggles com mola, skeletons com brilho, check animado ao salvar, shake suave em erro de campo, toasts empilháveis, **o número da margem efetiva muda de cor com transição quando cruza o mínimo ou o alvo**.
- Transições entre telas (shared-element: card da OS → detalhe; linha do orçamento → composição).
- `prefers-reduced-motion`: trocar tudo por fades curtos; nada essencial depende de animação. No Modo Operador, animação mínima.

## 5. SISTEMA DE COMPONENTES (entregar a biblioteca, em todos os temas e estados)

Botões (primário, secundário, terciário, destrutivo, ícone, grande/operador) · Campos (texto, número com unidade, moeda, percentual, horas decimal/hh:mm, CPF/CNPJ, placa, telefone, CEP, busca, textarea) · **Select/Combobox custom**, **Date/Range picker custom**, **Upload com arrastar-e-soltar + câmera**, checkbox/radio/switch/slider/segmented control (nenhum controle nativo cru) · **Badge de status** (mapas da seção 3.3) · **Badge de versão de custos** · Chips de filtro · **Tabela de dados** (cabeçalho fixo, ordenação, seleção em massa, densidade ajustável, colunas configuráveis, linha expansível, paginação, estado vazio) · **Grade editável de linhas do orçamento** (tipos de linha com ícone, edição inline, totais ao vivo, teclado) · **Árvore de composição de custo** (nós expansíveis com barra proporcional e valor) · **Semáforo de margem** (mínimo, alvo, efetiva) · **Curva de lote** (mini gráfico 1 · 10 · 50 · 100) · **Par orçado × real** (dois valores + desvio + semáforo) · **Comparador de versões** (Tabela de Custos e orçamento: diff por linha com delta) · Cards (KPI, OS, orçamento, centro de trabalho, item, NC) · **Kanban** de OS e de oportunidades · **Gantt de carga × capacidade** (por centro e semana, com % de ocupação) · **Timeline** (histórico e auditoria) · Stepper do fluxo da OS · **Cronômetro de apontamento** (setup × produção, pausa com motivo, boa/refugo) · **Checklist com câmera** (oficina) · **Assinatura digital** · **Medição com semáforo** (valor medido versus faixa de tolerância, barra com marcador) · **Comparador de cotações** · **Matriz de permissões** (módulos × visualizar/gerenciar + permissões sensíveis) · **Seletor de perfil de segmento** com checagem de impacto · **Importador de planilha** (upload → mapeamento de colunas → prévia → confirmação) · Tabs em cápsula · Breadcrumbs · **Sidebar azul-aço em vidro, flutuante e recolhível**, com grupos e itens filtrados por permissão · **Topbar em cápsula de vidro** com busca, notificações, tema, avatar · **Paleta de comandos** · Modal, Sheet lateral e bottom sheet · Popover/Tooltip/Dropdown de ações · Toasts · Skeletons · Empty states com ilustração · Banners de erro/offline/sincronizando.

Componentes próprios da identidade Aço & Fagulha: **Faixa de topo (hero)** azul-aço com ilustração do processo e KPIs em vidro · **Painel de preço em vidro sobre placa laranja→azul** · **Chip de custo** (ícone colorido por tipo de linha ou de custo) · **Faixa zebrada de aviso** · **Desenho técnico da peça** · **Placa Mercosul** · **Anel de ocupação** · **Barras orçado (cinza) × real (cor)**.

Componentes de cadastro: **Chat de cadastro conversado** (pergunta uma coisa por vez, respostas sugeridas tocáveis, campo livre que entende "22 mil" ou "R$ 22.000,00", cartões de consulta de CNPJ/CEP/placa, cartões de cálculo, "Voltar uma pergunta", ficha ao lado preenchendo ao vivo) · **Listagem padrão** (faixa de topo com "Novo…" e "Cadastrar conversando", KPIs, busca que filtra ao digitar, filtros por situação com contagem, seleção em massa, densidade, exportar, paginação, estados com dados/carregando/vazio/sem permissão, tabela que vira cartões no celular) · **Formulário padrão** (seções numeradas que ficam verdes quando completas, campos com unidade e validação em linguagem simples, opções em cápsula, interruptores, salvamento automático, atalho "Prefere conversar?" e **painel lateral de contexto em vidro**: ficha 360°, custo-hora ao vivo, conversão de unidade, histórico).

## 6. TELAS A PROJETAR (protótipo navegável, nesta ordem)

Para **cada** tela: desktop 1440 e mobile 390; tablet 1024 para as telas de chão de fábrica; temas Claro (padrão), Escuro e Alto contraste; estados carregando / vazio / erro / sem permissão. Toda tela de módulo abre com a **faixa de topo azul-aço com a ilustração do seu processo**, uma saudação ou resumo em linguagem de gente e os KPIs em vidro. Onde houver perfil de segmento, mostrar **a mesma tela em OFICINA e em USINAGEM** (campos e colunas diferentes).

1. **App shell** — sidebar de vidro recolhível (grupos da seção 1.3), topbar com large title, busca ⌘K, sino com painel, seletor de tema, menu do usuário, **badge da filial ativa e da versão de custos vigente**; versão mobile com tab bar inferior + "Mais".
2. **Motor de Custos — Centro de trabalho** — ficha do centro (dados da seção 1.5) com o resultado em destaque: custo específico/h, taxa de rateio/h, **custo-hora cheio e marginal**, árvore de composição (mão de obra, manutenção, insumos, depreciação, energia, rateio) e histórico do custo-hora por versão.
3. **Motor de Custos — Tabela de Custos** — lista de versões (competência, status, autor), **comparativo lado a lado entre duas versões** (delta por centro com semáforo), telas de Custo fixo (lançamentos por categoria com origem "Contas a pagar" ou manual), Capacidade (dias úteis × turnos × horas × eficiência = horas reais, por centro) e Rateio (critério e pesos somando 100%); **fluxo de publicação** com resumo de impacto; **Simulador what-if** (sliders de eficiência, custo fixo, salário, nova máquina → impacto por centro, sem publicar).
4. **Orçamento — editor** — cabeçalho (cliente, template, objeto, lote, validade, versão de custos), grade editável por bloco de linhas, **painel lateral sticky "Como chegamos nesse preço"** (composição, impostos, comissão, margem alvo, desconto, margem efetiva com semáforo, margem de contribuição, preço final grande), **curva de lote**, aviso de versão de custos desatualizada, fluxo "Pedir aprovação do gerente"; versão USINAGEM (roteiro com setup × ciclo) e versão OFICINA (peças com margem própria + mão de obra por tempo padrão).
5. **Orçamentos — lista e detalhe** — tabela + kanban por status, filtros (cliente, segmento, vendedor, validade, margem), **comparativo de versões v1 × v2**, histórico de envio e aceite, botão "Converter em OS".
6. **Simulador rápido** — cotação sem cliente em uma tela, para responder ao telefone; "Transformar em orçamento".
7. **Portal do cliente** — página pública no celular: orçamento com resumo (material, mão de obra, terceiros, total), **aceite digital**, acompanhamento da OS com status e fotos, 2ª via, agendamento (oficina). Sem custo-hora, sem margem.
8. **Ordens de Serviço — lista e detalhe** — tabela + kanban + agenda por centro; detalhe com cabeçalho (status, stepper do fluxo, versão de custos, prazo prometido), abas: Visão geral · Roteiro · Materiais · Apontamentos e pausas · Qualidade · Compras · Financeiro · Histórico; **painel lateral fixo orçado × real** (horas, materiais, terceiros, custo, margem) com desvios. Versões OFICINA (veículo, km, checklist com fotos, diagnóstico, garantia) e USINAGEM (peça, desenho e revisão, lote, roteiro, inspeção dimensional).
9. **OS — recepção (oficina)** — fluxo guiado: veículo (consulta de placa) → checklist de entrada com câmera → diagnóstico → itens recomendados → orçamento → aceite no balcão.
10. **Apontamento (Modo Operador, tablet 1024)** — lista de trabalho do centro e do operador, OS do dia, **botões gigantes Setup / Produção / Pausar / Encerrar**, cronômetro, quantidade boa e refugo, motivo de pausa em botões grandes, leitura de QR da OS, indicador de offline e fila de sincronização.
11. **Planejamento e Agenda** — Gantt de carga × capacidade por centro e semana, fila sequenciável (arrastar e soltar), promessa de prazo, bloqueios de manutenção; agenda por box e mecânico (oficina) com hora marcada.
12. **Qualidade** — lista de inspeções, formulário de medição com semáforo de tolerância, abertura de não-conformidade, galeria de fotos com lightbox, rastreabilidade lote → OS → peça, laudo em PDF.
13. **Estoque e Compras** — saldos (físico, reservado, disponível) com ponto de pedido, movimentações, lotes com certificado, requisições por origem, **comparativo de cotações lado a lado** destacando o melhor preço e prazo, pedidos com alçada, recebimento com divergência.
14. **Financeiro** — contas a receber e a pagar (vencimentos, baixa parcial e em lote, **flags "compõe custo fixo" e "custo direto de centro" na linha**), fluxo de caixa realizado × previsto, comissões, DRE gerencial por filial e segmento.
15. **Manutenção e RH** — planos preventivos por horas apontadas ou calendário, ordens de manutenção, custo por centro com média móvel e proposta ao Motor de Custos; funcionários com habilitações e validade, ausências, custo-hora.
16. **Cadastros — cada um com a sua listagem e o seu formulário** — Clientes (PF/PJ, consulta de CNPJ e CEP, ficha 360°), Funcionários (custo-hora ao vivo, habilitações, valores restritos mascarados), Fornecedores (últimos preços), Veículos (busca por placa, km só aumenta) e Ativos do cliente (desenhos e peças de reposição), Itens (unidade de compra × consumo, custo por peça ao vivo), Catálogo de operações (tempo padrão com origem e custo por lote), Centros de trabalho (custo-hora recalculando enquanto edita), Centros de custo (custo fixo × custo direto), Usuários (perfil e permissões sensíveis), Tabelas auxiliares.
16a. **Cadastro conversado** — central "O que vamos cadastrar hoje?" (aceita texto livre, como "quero cadastrar um soldador novo") com um chat por cadastro, e o chat de máquina e custo-hora que reproduz a planilha passo a passo (custo fixo → horas reais → rateio → custo específico → custo-hora cheio → preço da hora).
17. **Painel ("Central de Comando") e BI** — KPIs da seção 1.7, ocupação por centro, margem real × orçada, custo-hora efetivo × tabelado, ponto de equilíbrio, recalibrações pendentes, feed de atividades; painéis de BI por área.
18. **Configurações** — Empresa e Filiais, **Perfil de segmento com checagem de impacto**, Usuários e perfis com matriz de permissões, Parâmetros (horas de expediente, eficiência, margem mínima e alvo, impostos padrão, método de preço, tolerâncias, limite do serviço rápido), **Importador da planilha de precificação** (mapeamento → prévia → Tabela de Custos em rascunho), Integrações e webhooks, Trilha de auditoria (diff antes/depois).
19. **Login** — card Liquid Glass, e-mail e senha, erro acessível, bloqueio por tentativas, troca de senha no primeiro acesso; fundo de peças usinadas em wireframe.
20. **Estados globais** — 403 sem permissão, 404, offline/reconectando, sessão expirada, manutenção.

## 7. ACESSIBILIDADE E RESPONSIVIDADE (inegociável)

WCAG 2.2 AA em todos os temas (AAA no Alto contraste): texto ≥ 4,5:1, UI ≥ 3:1; foco sempre visível; navegação completa por teclado, inclusive na grade do orçamento; alvos ≥ 44 px (56 px no Modo Operador); nunca cor como único sinal; rótulos reais nos campos; `aria-live` para toasts e para o recálculo do preço; suporte a zoom 200%. Mobile-first; breakpoints 390 / 768 / 1024 / 1440 / 1920; tabelas viram cards empilhados no mobile; ações primárias ao alcance do polegar.

## 8. PROIBIÇÕES

- Sem controles nativos crus; sem `alert/confirm`; sem botão "Calcular".
- Sem gradientes roxo-rosa ou índigo genéricos, sem emojis como ícones, sem lorem ipsum (usar os dados da seção 1.6).
- **Sem cara de IA:** não usar Inter, Roboto ou Arial; não usar rótulos em CAIXA-ALTA espaçada; não pôr vidro em tudo nem vidro sobre fundo liso; não usar fundo escuro como padrão; não escrever mensagens robóticas ("Operação concluída com sucesso", "Erro 422").
- Não usar laranja como enfeite: ele é ação (botão primário, um por tela) e calor/corte nas ilustrações.
- Não copiar layouts de terceiros; as referências (Apple HIG, 21st.dev, liquidglassdesign.com, Awwwards) servem de **princípio**, não de cópia.
- **Não inventar módulos fora da seção 1.3** e não desenhar emissão fiscal, apuração de impostos, folha de pagamento ou ponto eletrônico.
- Não mostrar custo-hora, rateio ou margem em nenhuma tela do portal do cliente.
- Não mostrar um preço sem caminho para a sua composição.
- Não misturar segmentos numa mesma tela sem indicar o perfil ativo.

## 8.1 REFERÊNCIAS CONSULTADAS (use como princípio)

- **Apple HIG / Liquid Glass (WWDC 2025):** material translúcido que refrata o conteúdo e reage à luz; fica nas camadas de navegação e controle, não no conteúdo.
- **liquidglassdesign.com:** técnicas web em ordem de custo — CSS (blur + borda + sombra), SVG com `feDisplacementMap` (refração sem WebGL), WebGL/shaders só para peça de impacto.
- **21st.dev:** catálogo React + Tailwind (padrão shadcn) útil como inspiração de números animados (Number Ticker), botões com brilho, cards e navegação.
- **Awwwards:** filtros "UI design", "Scrolling", "Animated websites" como régua de ritmo de scroll e acabamento; a linguagem de dados vem do Apple HIG e das necessidades das personas.

## 9. ENTREGA

1. Protótipo navegável com todas as telas da seção 6, alternância de tema (Claro / Escuro / Alto contraste), Modo Operador e **alternância de perfil de segmento (OFICINA / USINAGEM / CALDEIRARIA)** nas telas que mudam.
2. Página de **Design System**: tokens (cor, tipo, espaço, raio, sombra, vidro, movimento), biblioteca de **ilustrações de processo** (torno, solda, paquímetro, elevador de oficina), guia de **voz e tom** com exemplos de antes e depois, todos os componentes e estados, nos três temas, incluindo os componentes de custo da seção 5.
3. Notas curtas de decisão: por que cada escolha de cor, tipografia e densidade serve a cada persona, e como a UI cumpre as regras de domínio da seção 1.4.
4. Lista dos tokens em formato exportável (CSS variables / `tailwind.config`) para a implementação, alinhada a `docs/design/promec-tokens.css` e `docs/design/tailwind.promec.js`.

Comece pelo **Design System (tokens + componentes-chave, com ênfase nos componentes de custo)**, depois **App shell → Centro de trabalho → Tabela de Custos → Orçamento (editor) → Portal → OS (lista e detalhe) → Apontamento**, e então as demais telas. Mostre cada etapa para validação antes de seguir.
