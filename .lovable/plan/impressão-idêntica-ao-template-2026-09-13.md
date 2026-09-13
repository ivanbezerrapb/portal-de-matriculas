# Impressão idêntica ao template

## O problema

No template, a caixa "Nº FICHA" tem tamanho fixo e, logo abaixo, encostada nela, fica a data. Na impressão, quando o texto da ficha é maior do que a caixa desenhada, ele quebra em duas linhas e a caixa cresce — invadindo a linha da data. Resultado: os dois textos aparecem um por cima do outro.

Hoje a impressão tem a regra de "crescer e empurrar o que está abaixo", mas ela só empurra blocos que foram desenhados com um espaço livre entre eles. Caixas encostadas ou levemente sobrepostas (como essa) não são empurradas, e o texto se sobrepõe.

## O que vai mudar

1. **O texto encolhe para caber na caixa.** Toda caixa de resposta, tabela ou lista passa a manter exatamente a largura e a altura desenhadas no template. Se o conteúdo não couber, a letra é reduzida em pequenos passos até caber (com um limite mínimo para continuar legível). Nada muda de lugar, e a folha impressa fica igual à montagem.

2. **Rede de segurança.** Se mesmo no tamanho mínimo o conteúdo não couber (por exemplo, uma lista de crianças muito longa), a caixa cresce como hoje — mas agora empurrando corretamente tudo o que estiver abaixo, inclusive caixas encostadas, sem sobreposição. O aviso de "conteúdo fora do limite da folha" continua funcionando.

3. **Pré-visualização confiável.** A pré-visualização com um cadastro real (botão "Pré-visualizar impressão") passa a usar exatamente o mesmo cálculo da impressora, então o que você vê ali é o que sai no papel. A área de montagem continua mostrando os rótulos dos campos, como hoje.

## Detalhes técnicos

- `src/components/print/DynamicPrintPage.tsx`: substituir o crescimento automático por um ajuste de escala tipográfica por bloco. Medir `scrollHeight`/`scrollWidth` do conteúdo contra a caixa (`block.w` x `block.h`) e aplicar um fator de escala (busca em passos, ex.: 1 → 0.6 em incrementos de 0.05) via variável CSS repassada ao `BlockView`; só quando o fator mínimo ainda estourar, voltar ao comportamento de crescer.
- `src/components/print/BlockView.tsx`: os tamanhos de fonte (`block.fontSize`, células de tabela, lista de crianças) passam a multiplicar pelo fator de escala recebido, mantendo proporções de padding/linha.
- Regra de empilhamento em `useDynamicPrintLayout`: passar a empurrar qualquer bloco cujo topo esteja abaixo do topo do bloco anterior e que se sobreponha horizontalmente, deslocando pelo excedente de altura (delta), em vez de exigir folga original entre eles.
- `overflow: hidden` nas caixas não dinâmicas continua; as dinâmicas passam a `hidden` também quando couberam por escala.
- A pré-visualização (`LayoutEditor`, `DynamicPrintPage` com `preview`) e a impressão (`PrintSheets`) usam o mesmo caminho de renderização, sem divergência de altura.
- Nenhuma alteração de banco de dados e nenhum layout salvo é modificado.

## Verificação

Abrir o template "Impressão Conecta", pré-visualizar com um cadastro real e conferir que o "Nº FICHA" e a data ficam nas posições desenhadas, sem sobreposição, e que a tabela de crianças continua legível.
