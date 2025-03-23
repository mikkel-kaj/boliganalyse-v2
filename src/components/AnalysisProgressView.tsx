import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import AnalysisProgress from "@/components/AnalysisProgress";
import { AnalysisStatus } from '@/lib/status';
import { StatusStepList, StatusError } from './status';

interface AnalysisProgressViewProps {
    status: AnalysisStatus;
    propertyImageUrl?: string;
    address: string;
    errorMessage?: string;
}

const AnalysisProgressView: React.FC<AnalysisProgressViewProps> = ({
    status,
    propertyImageUrl,
    address,
    errorMessage
}) => {
    return (
        <div className="container py-12">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-2 mb-8">
                    <Button asChild variant="ghost" size="icon" className="rounded-full">
                        <Link to="/"><ArrowLeft className="h-4 w-4"/></Link>
                    </Button>
                    <h1 className="text-2xl font-medium">{address}</h1>
                </div>

                <AnalysisProgress
                    status={status}
                    propertyImageUrl={propertyImageUrl}
                    errorMessage={errorMessage}
                />

                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-xl font-medium mb-4">Hvad sker der nu?</h2>
                        <p className="text-muted-foreground mb-4">
                            Vores AI-system arbejder på at analysere boligen. Dette inkluderer:
                        </p>

                        <StatusStepList 
                            currentStatus={status} 
                            className="mb-4"
                        />

                        <StatusError
                            status={status}
                            errorMessage={errorMessage}
                            showRetryButton={true}
                        />
                        
                        {!isErrorStatus(status) && (
                            <p className="text-sm text-muted-foreground">
                                Siden opdaterer automatisk, når analysen er færdig. Du behøver ikke at genindlæse siden.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

// Helper import
import { isErrorStatus } from '@/lib/status/utils';

export default AnalysisProgressView;