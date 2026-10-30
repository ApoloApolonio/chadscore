import Link from "next/link";
import { ESTIMATE_NOTICE } from "@/lib/analysis-schema";

export default function PrivacyPage() {
  return (
    <main className="app-surface min-h-svh px-5 pb-12 sm:px-8">
      <header className="brand-header"><Link href="/" className="brand blue-focus">ChadScore<span>.</span></Link></header>
      <article className="mx-auto max-w-xl text-sm leading-relaxed text-slate-300">
        <h1 className="mb-6 text-2xl font-medium text-white">Privacidade e limites</h1>
        <p>No FaceScan, a análise começa somente ao clicar em Analisar rosto. A câmera solicita a permissão nativa do navegador, sem áudio, e é desligada ao capturar ou fechar.</p>
        <p className="mt-4">Fotos, pontos e resultados ficam apenas na memória desta aba. Não há upload, conta, cookies de análise ou gravação em banco, localStorage ou sessionStorage. Atualizar ou fechar descarta a sessão. URLs temporárias são revogadas ao trocar de foto ou descartar a sessão; isso não garante apagamento criptográfico imediato da memória.</p>
        <p className="mt-4">O navegador baixa somente arquivos estáticos, fontes e modelos MediaPipe. O processamento é gratuito e local. Os arquivos são validados por formato, assinatura, tamanho e decodificação. Use apenas fotos que você tem autorização para analisar.</p>
        <p className="mt-4">No MogBattle, Iniciar batalha começa imediatamente a análise quando há duas fotos válidas, sem confirmação ou checkbox. Use imagens dos participantes somente com autorização deles. O app não verifica nem registra essa autorização. Nomes opcionais, fotos e resultados ficam somente na memória da batalha. Trocar ou remover fotos, batalhar novamente ou sair do modo descarta o estado correspondente e revoga as URLs temporárias. Uma análise concluída pode ser reutilizada enquanto a mesma foto permanecer nessa batalha. Não há contas, streaming ou batalhas remotas nesta versão.</p>
        <p className="mt-4">{ESTIMATE_NOTICE}</p>
        <p className="mt-4">A calibração v3 dá peso de 70% à estrutura aparente 2D e 30% à harmonia/simetria, com critérios estéticos subjetivos. Pele e cabelo são índices separados de apresentação fotográfica e não alteram a nota geral. Não se mede estrutura óssea por sombras. Luz difusa, expressão neutra, câmera centralizada e distância/lente semelhantes ajudam a comparar capturas; não há correção garantida de perspectiva.</p>
        <p className="mt-4">Os resultados não devem orientar diagnósticos ou procedimentos. Não foi demonstrada ausência de viés entre grupos. Captura sem confiança suficiente solicita outra foto, sem nota ou vencedor; índices regionais indisponíveis são exibidos como —.</p>
        <Link href="/" className="primary-button blue-focus mt-8 inline-block rounded-full px-6 py-3 text-sm font-medium">Voltar ao início</Link>
      </article>
    </main>
  );
}
