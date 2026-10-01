import InfoPage from '@/components/InfoPage';

export default function Markets(){
  return <InfoPage eyebrow="Market overview" title="Explore the market workspace" lead="Review instruments and market views in one place, then continue into the simulated trading workspace when you are ready to explore an order flow." sections={[
    {title:'Market information',content:<p>The platform presents market views for exploration. Values shown in this deployment are simulated and should not be treated as live prices, quotes, or a basis for investment decisions.</p>},
    {title:'Trading workspace',content:<p>The trade area demonstrates instrument selection, price charts, order-book presentation, and order entry. Submitting an order in this environment does not route it to an external exchange or execute a real transaction.</p>},
    {title:'Consider the risks',content:<p>Financial markets involve risk, including the possible loss of invested capital. Simulation results do not represent actual trading outcomes and may not reflect liquidity, fees, slippage, or market conditions.</p>},
  ]}/>;
}