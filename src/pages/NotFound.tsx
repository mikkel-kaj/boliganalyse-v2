import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { HomeIcon } from "lucide-react";
import SEO from "@/components/SEO";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Fejl: Bruger forsøgte at tilgå ikke-eksisterende rute:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-80px)]">
      <SEO 
        title="404 - Side ikke fundet | Boliganalyse.ai"
        description="Denne side blev ikke fundet. Besøg vores hjemmeside for at analysere boliger med AI-teknologi."
        ogType="website"
      />
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-purple mb-6">404</h1>
        <p className="text-xl mb-8">Ups! Siden blev ikke fundet</p>
        <p className="text-muted-foreground mb-8">
          Vi kunne ikke finde den side, du leder efter. Den er muligvis blevet fjernet,
          omdøbt eller er midlertidigt utilgængelig.
        </p>
        <Button asChild>
          <Link to="/" className="inline-flex items-center gap-2">
            <HomeIcon className="h-4 w-4" />
            Gå tilbage til forsiden
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
