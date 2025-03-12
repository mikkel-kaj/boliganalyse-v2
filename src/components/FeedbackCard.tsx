
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackForm from "./FeedbackForm";

interface FeedbackCardProps {
  propertyId?: string;
  propertyAddress?: string;
}

const FeedbackCard = ({ propertyId, propertyAddress }: FeedbackCardProps) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Din feedback</CardTitle>
        <CardDescription>
          Hjælp os med at forbedre vores ejendomsanalyse
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FeedbackForm 
          propertyId={propertyId}
          propertyAddress={propertyAddress}
        />
      </CardContent>
    </Card>
  );
};

export default FeedbackCard;
