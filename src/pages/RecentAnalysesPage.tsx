
import { Link } from 'react-router-dom';

const RecentAnalysesPage = () => {
  // Mock data
  const recentProperties = [
    {
      id: "demo1",
      address: "Mågevej 12, 2400 København",
      price: "2 995 000",
      size: "75",
      image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80",
      timeAgo: "5 min",
      risks: [
        { label: "Slidt badeværelse", icon: "🚿", color: "risk-building" },
        { label: "Ældre vinduer", icon: "🪟", color: "risk-technical" },
      ],
      highlights: [
        { label: "Moderne køkken", icon: "🍽️", color: "highlight-kitchen" },
        { label: "Tæt på metro", icon: "🚇", color: "highlight-transport" },
      ]
    },
    {
      id: "demo2",
      address: "Vesterbrogade 67, 1620 København",
      price: "4 250 000",
      size: "92",
      image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80",
      timeAgo: "2 timer",
      risks: [
        { label: "Lav energimærkning", icon: "⚡", color: "risk-default" },
        { label: "Ventilationsproblemer", icon: "💨", color: "risk-ventilation" },
      ],
      highlights: [
        { label: "Nyligt renoveret", icon: "🏗️", color: "highlight-default" },
        { label: "Elevator i bygningen", icon: "🛗", color: "highlight-facilities" },
      ]
    },
    {
      id: "demo3",
      address: "Amagerbrogade 123, 2300 København",
      price: "3 495 000",
      size: "81",
      image: "https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80",
      timeAgo: "1 dag",
      risks: [
        { label: "Støj fra gaden", icon: "🔊", color: "risk-default" },
        { label: "Gamle rør", icon: "🔧", color: "risk-technical" },
      ],
      highlights: [
        { label: "Altan", icon: "🏠", color: "highlight-default" },
        { label: "Ingen dokumentavgift", icon: "💰", color: "highlight-financial" },
      ]
    },
    {
      id: "demo4",
      address: "Østerbrogade 45, 2100 København",
      price: "5 750 000",
      size: "110",
      image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80",
      timeAgo: "3 dage",
      risks: [
        { label: "Ældre bygning", icon: "🏛️", color: "risk-history" },
        { label: "Behov for badeværelsesrenovering", icon: "🛁", color: "risk-building" },
      ],
      highlights: [
        { label: "God transportmulighed", icon: "🚌", color: "highlight-transport" },
        { label: "Fællesfaciliteter", icon: "🏘️", color: "highlight-community" },
      ]
    },
    {
      id: "demo5",
      address: "Nørrebrogade 142, 2200 København",
      price: "3 295 000",
      size: "68",
      image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80",
      timeAgo: "1 uge",
      risks: [
        { label: "Indvendig støj", icon: "🔊", color: "risk-default" },
        { label: "Ældre elinstallationer", icon: "⚡", color: "risk-technical" },
      ],
      highlights: [
        { label: "Nyligt renoveret", icon: "🏗️", color: "highlight-default" },
        { label: "God beliggenhed", icon: "📍", color: "highlight-transport" },
      ]
    },
    {
      id: "demo6",
      address: "Frederiksberg Allé 8, 1820 Frederiksberg",
      price: "6 795 000",
      size: "145",
      image: "https://images.unsplash.com/photo-1554995207-c18c203602cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80",
      timeAgo: "2 uger",
      risks: [
        { label: "Høj boligafgift", icon: "💰", color: "risk-default" },
        { label: "Behov for vinduesudskiftning", icon: "🪟", color: "risk-technical" },
      ],
      highlights: [
        { label: "Unik arkitektur", icon: "🏛️", color: "highlight-default" },
        { label: "Eksklusiv beliggenhed", icon: "🌳", color: "highlight-transport" },
      ]
    }
  ];

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-bold mb-8">Nyligt analyserede boliger</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recentProperties.map((property) => (
          <Link 
            key={property.id} 
            to={`/analyse/${property.id}`}
            className="property-card bg-card rounded-xl overflow-hidden border border-border hover:border-purple/30 transition-all"
          >
            <div className="relative">
              <img 
                src={property.image} 
                alt={property.address} 
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-full">
                {property.timeAgo} siden
              </div>
            </div>
            
            <div className="p-4">
              <h3 className="font-medium mb-1">{property.address}</h3>
              <p className="text-lg font-bold mb-2">{property.price} kr</p>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                <span>{property.size} m²</span>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">RISIKOFAKTORER</h4>
                <div className="flex flex-wrap gap-2">
                  {property.risks.map((risk, idx) => (
                    <span key={idx} className={`risk-badge bg-${risk.color}`}>
                      {risk.icon} {risk.label}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">HØJDEPUNKTER</h4>
                <div className="flex flex-wrap gap-2">
                  {property.highlights.map((highlight, idx) => (
                    <span key={idx} className={`highlight-badge bg-${highlight.color}/20 text-${highlight.color}`}>
                      {highlight.icon} {highlight.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RecentAnalysesPage;
