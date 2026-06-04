const summaryCards = [
  { label: 'Total Socios Activos', value: '—', icon: '👥' },
  { label: 'Cartera Total', value: '—', icon: '📂' },
  { label: 'Pagos del Mes', value: '—', icon: '💰' },
  { label: 'Mora Actual', value: '—', icon: '⚠️' },
]

export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Bienvenido al sistema COOPAC CEJUASSA
      </h1>
      <p className="text-gray-500 mb-8">Resumen general del sistema</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{card.icon}</span>
            </div>
            <p className="text-3xl font-bold text-gray-800 mb-1">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
