import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import AnalysisProgress from "@/components/AnalysisProgress";

interface AnalysisProgressViewProps {
    status: string;
    propertyImageUrl?: string;
    address: string;
}

const AnalysisProgressView: React.FC<AnalysisProgressViewProps> = ({
    status,
    propertyImageUrl,
    address
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
                />

                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-xl font-medium mb-4">Hvad sker der nu?</h2>
                        <p className="text-muted-foreground mb-4">
                            Vores AI-system arbejder på at analysere boligen. Dette inkluderer:
                        </p>

                        <ul className="space-y-2 mb-4">
                            <li className="flex items-center gap-2">
                                <div
                                    className={`h-2 w-2 rounded-full ${status !== "Starter analyse" ? 'bg-green-500' : 'bg-purple animate-pulse'}`}/>
                                <span>Forberedelse af analyse</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div
                                    className={`h-2 w-2 rounded-full ${status === "Søger efter salgsopslag" ? 'bg-purple animate-pulse' : (status === "Starter analyse" ? 'bg-gray-300' : 'bg-green-500')}`}/>
                                <span>Indsamling af data fra boligannoncen</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div
                                    className={`h-2 w-2 rounded-full ${status === "Opslag fundet!" ? 'bg-purple animate-pulse' : (["Starter analyse", "Søger efter salgsopslag"].includes(status) ? 'bg-gray-300' : 'bg-green-500')}`}/>
                                <span>Indledende analyse af boligen</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div
                                    className={`h-2 w-2 rounded-full ${status === "Første fase analyse gennemført" ? 'bg-purple animate-pulse' : (["Starter analyse", "Søger efter salgsopslag", "Opslag fundet!"].includes(status) ? 'bg-gray-300' : 'bg-green-500')}`}/>
                                <span>Identifikation af nøgleinformation</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div
                                    className={`h-2 w-2 rounded-full ${status === "Leder efter fejl og mangler.." ? 'bg-purple animate-pulse' : (["Starter analyse", "Søger efter salgsopslag", "Opslag fundet!", "Første fase analyse gennemført"].includes(status) ? 'bg-gray-300' : 'bg-green-500')}`}/>
                                <span>AI-vurdering af risici og højdepunkter</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div
                                    className={`h-2 w-2 rounded-full ${status === "Analyse fuldført" ? 'bg-green-500' : 'bg-gray-300'}`}/>
                                <span>Færdiggørelse af analysen</span>
                            </li>
                        </ul>

                        <p className="text-sm text-muted-foreground">
                            Siden opdaterer automatisk, når analysen er færdig. Du behøver ikke at genindlæse siden.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AnalysisProgressView; 