import React from "react";
import SEO from "@/components/SEO";

const TermsPage: React.FC = () => {
  return (
    <div className="container py-8 sm:py-12 md:py-16 max-w-4xl">
      <SEO 
        title="Vilkår og betingelser | Boliganalyse.ai"
        description="Vilkår og betingelser for brug af Boliganalyse.ai, en platform der bruger AI til at analysere boligopslag."
        ogType="website"
      />
      
      <h1 className="text-3xl font-bold mb-8">Vilkår og betingelser</h1>
      
      <div className="space-y-8 text-muted-foreground">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">1. Introduktion</h2>
          <p>
            Velkommen til Boliganalyse.ai ("tjenesten", "vi", "os" eller "vores"). Disse vilkår og betingelser styrer din brug
            af vores hjemmeside, som er tilgængelig på boliganalyse.ai.
          </p>
          <p className="mt-2">
            Ved at bruge vores tjeneste accepterer du at være bundet af disse vilkår. Hvis du er uenig i nogen del af vilkårene, 
            må du ikke bruge vores tjeneste.
          </p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">2. Brug af tjenesten</h2>
          <p>
            Boliganalyse.ai tilbyder en platform, der bruger kunstig intelligens til at analysere boligopslag og give indsigt
            om boligmarkedet. Tjenesten er kun til informationsformål.
          </p>
          <p className="mt-2">
            Du må ikke misbruge vores tjeneste eller forsøge at få adgang til den via andre metoder end de grænseflader, 
            vi tilbyder. Du må kun bruge tjenesten som tilladt af lov, herunder gældende eksportkontrol og sanktioner.
          </p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">3. Ansvarsfraskrivelse</h2>
          <p>
            Analyserne fra Boliganalyse.ai er baseret på kunstig intelligens og tilgængelige data, og er derfor kun vejledende. 
            Vi garanterer ikke nøjagtigheden af de frembragte analyser.
          </p>
          <p className="mt-2">
            Brugere bør altid rådføre sig med professionelle og uafhængige ejendomsrådgivere før køb, salg eller investering i fast ejendom.
            Vores tjeneste erstatter ikke professionel rådgivning.
          </p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">4. Intellektuel ejendomsret</h2>
          <p>
            Indholdet på Boliganalyse.ai, herunder tekst, grafik, logoer, billeder og softwarekode, er beskyttet af ophavsret og andre
            immaterielle rettigheder og tilhører Boliganalyse.ai eller vores licensgivere.
          </p>
          <p className="mt-2">
            Du må ikke reproducere, distribuere, ændre eller på anden måde bruge indholdet uden vores udtrykkelige tilladelse.
          </p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">5. Privatlivs- og datapolitik</h2>
          <p>
            Vi respekterer dit privatliv og er forpligtet til at beskytte dine personlige oplysninger. Vi indsamler kun de data, 
            der er nødvendige for at tilbyde vores tjeneste.
          </p>
          <p className="mt-2">
            Når du bruger Boliganalyse.ai, kan vi indsamle og behandle følgende oplysninger:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>De boliglinks du analyserer</li>
            <li>Data relateret til din brug af tjenesten, herunder besøgstider og browserinformation</li>
            <li>Anonymiserede data til statistik og forbedring af tjenesten</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">6. Ændringer af vilkår</h2>
          <p>
            Vi forbeholder os ret til at ændre eller udskifte disse vilkår når som helst. Det er dit ansvar at tjekke vilkårene periodisk
            for ændringer. Din fortsatte brug af tjenesten efter enhver ændring udgør din accept af de nye vilkår.
          </p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">7. Kontakt os</h2>
          <p>
            Hvis du har spørgsmål eller kommentarer til disse vilkår, bedes du kontakte os på info@boliganalyse.ai.
          </p>
        </section>
      </div>
      
      <div className="mt-12 text-sm text-muted-foreground">
        <p>Senest opdateret: Juni 2024</p>
      </div>
    </div>
  );
};

export default TermsPage; 