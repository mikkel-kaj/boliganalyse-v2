import { useState, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { setCookie, hasCookie } from '@/lib/cookie';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Cookie name to track survey response
const SURVEY_COOKIE_NAME = 'boliganalyse:survey-responded';
// Cookie expiration in days (1 year)
const SURVEY_COOKIE_EXPIRATION = 365;
// Survey URL from Google Forms
const SURVEY_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdXWeGGljlIxomSOdZi4eMAhgvXAGfv8YmDr_41d5PiHV430w/viewform?usp=dialog';

interface SurveyDialogProps {
    isAnalysisComplete?: boolean;
}

export function SurveyDialog({ isAnalysisComplete = false }: SurveyDialogProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        // Only show the survey if the analysis is complete and the user hasn't responded yet
        if (isAnalysisComplete && !hasCookie(SURVEY_COOKIE_NAME)) {
            // Add a small delay to show the survey after the analysis is displayed
            const timer = setTimeout(() => {
                setOpen(true);
            }, 2000);
            
            return () => clearTimeout(timer);
        }
    }, [isAnalysisComplete]);

    const handleOpenSurvey = () => {
        // Open the survey in a new tab
        window.open(SURVEY_URL, '_blank');
        
        // Mark the user as having seen the survey
        setCookie(SURVEY_COOKIE_NAME, 'true', SURVEY_COOKIE_EXPIRATION);
        
        // Close the dialog
        setOpen(false);
    };

    const handleDismiss = () => {
        // Mark the user as having dismissed the survey
        setCookie(SURVEY_COOKIE_NAME, 'dismissed', SURVEY_COOKIE_EXPIRATION);
        
        // Close the dialog
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Hjælp os med at forbedre Boliganalyse.ai</DialogTitle>
                    <DialogDescription>
                        Din feedback er afgørende for, at vi kan forstå dine behov og forbedre Boliganalyse.ai. 
                        Undersøgelsen består af 10 spørgsmål og tager kun et par minutter at gennemføre.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex flex-row items-center justify-between sm:justify-between">
                    <Button variant="outline" onClick={handleDismiss}>
                        <X className="mr-2 h-4 w-4" />
                        Nej tak
                    </Button>
                    <Button onClick={handleOpenSurvey}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Deltag i undersøgelsen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 