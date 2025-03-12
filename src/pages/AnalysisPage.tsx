
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import FeedbackCard from "@/components/FeedbackCard";

interface AnalysisData extends Tables<'apartment_listings'> {
  address?: string;
}

const AnalysisPage = () => {
  const { id } = useParams<{ id: string }>();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (!id) {
          setError("Property ID is missing.");
          return;
        }

        const { data, error } = await supabase
          .from('apartment_listings')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          throw new Error(error.message);
        }

        setAnalysisData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
  }, [id]);

  const renderAnalysisSection = (title: string, content: string | null | undefined, type: 'text' | 'json' = 'text') => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-4 w-[200px]" />
          ) : error ? (
            <p className="text-red-500">Error: {error}</p>
          ) : content ? (
            type === 'json' ? (
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {typeof content === 'string' ? JSON.stringify(JSON.parse(content), null, 2) : JSON.stringify(content, null, 2)}
              </pre>
            ) : (
              <p>{content}</p>
            )
          ) : (
            <p>No data available.</p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 gap-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ejendomsanalyse</h1>
            {analysisData?.url && (
              <a href={analysisData.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                Gå til original annonce
              </a>
            )}
          </div>
          {analysisData?.status && (
            <Badge variant="secondary">{analysisData.status}</Badge>
          )}
        </div>

        {renderAnalysisSection("HTML Content", analysisData?.html_content)}
        {renderAnalysisSection("Normalized URL", analysisData?.normalized_url)}
        {renderAnalysisSection("Property Image URL", analysisData?.property_image_url)}
        {renderAnalysisSection("Error Message", analysisData?.error_message)}
        {renderAnalysisSection("Partial Analysis", 
          analysisData?.partial_analysis ? JSON.stringify(analysisData?.partial_analysis) : null, 
          'json')}
        {renderAnalysisSection("Analysis", 
          analysisData?.analysis ? JSON.stringify(analysisData?.analysis) : null, 
          'json')}

        {analysisData && (
          <div className="mt-12">
            <FeedbackCard 
              propertyId={id}
              propertyAddress={analysisData.address}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPage;
