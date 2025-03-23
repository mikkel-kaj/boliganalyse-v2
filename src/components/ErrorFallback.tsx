import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { FallbackProps } from 'react-error-boundary';

/**
 * A fallback component to display when errors occur
 * Compatible with react-error-boundary
 */
const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  return (
    <div className="container py-12">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <CardTitle>Noget gik galt</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Der opstod en fejl under indlæsning af siden. Du kan prøve at genindlæse siden
            eller gå tilbage til forsiden.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-4 p-4 bg-gray-100 rounded overflow-auto text-xs">
              {error.message}
            </pre>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={resetErrorBoundary}>
            Genindlæs
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">
              Gå til forsiden
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ErrorFallback;