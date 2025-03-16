import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";

interface AnalysisInitialLoadingProps {
    error: string | null;
}

const AnalysisInitialLoading: React.FC<AnalysisInitialLoadingProps> = ({ error }) => {
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md mx-auto">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive"/>
                    <h2 className="text-xl font-medium mb-2">Der opstod en fejl</h2>
                    <p className="text-muted-foreground mb-6">{error}</p>
                    <Button asChild>
                        <Link to="/"><ArrowLeft className="mr-2 h-4 w-4"/> Tilbage til forsiden</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center max-w-md mx-auto">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin"/>
                <h2 className="text-xl font-medium mb-2">Indlæser analyse...</h2>
                <p className="text-muted-foreground">Vent venligst mens vi henter boliganalysen.</p>
            </div>
        </div>
    );
};

export default AnalysisInitialLoading; 