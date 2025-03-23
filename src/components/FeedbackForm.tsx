
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";
import {useToast} from "@/hooks/use-toast.ts";

type FeedbackType = 'idea' | 'problem' | 'other';

interface FeedbackFormData {
  feedbackType: FeedbackType;
  message: string;
  email?: string;
  propertyId?: string;
  propertyAddress?: string;
}

interface FeedbackFormProps {
  propertyId?: string;
  propertyAddress?: string;
}

const FeedbackForm = ({ propertyId, propertyAddress }: FeedbackFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FeedbackFormData>({
    defaultValues: {
      feedbackType: 'idea',
      message: '',
      email: '',
      propertyId,
      propertyAddress
    }
  });

  const onSubmit = async (data: FeedbackFormData) => {
    setIsSubmitting(true);

    try {
      // Add property information if available
      if (propertyId) {
        data.propertyId = propertyId;
      }
      
      if (propertyAddress) {
        data.propertyAddress = propertyAddress;
      }

      const { error } = await supabase
        .from('feedback')
        .insert([{
          feedback_type: data.feedbackType,
          message: data.message,
          email: data.email,
          property_id: data.propertyId,
          property_address: data.propertyAddress
        }]);

      if (error) throw error;

      toast({
        title: "Feedback modtaget",
        description: "Tak for din feedback. Vi sætter pris på din hjælp til at forbedre vores service.",
        duration: 5000,
      });

      // Reset form
      reset({
        feedbackType: 'idea',
        message: '',
        email: '',
        propertyId,
        propertyAddress
      });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Fejl ved indsendelse",
        description: "Der opstod en fejl ved indsendelse af din feedback. Prøv venligst igen senere.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="feedbackType" className="font-medium">
          Hvilken slags feedback har du?<span className="text-red-500">*</span>
        </Label>
        <RadioGroup defaultValue="idea" className="grid grid-cols-3 gap-2" id="feedbackType">
          <div className="flex items-center space-x-2">
            <RadioGroupItem 
              value="idea" 
              id="option-idea" 
              {...register('feedbackType', { required: true })}
            />
            <Label htmlFor="option-idea" className="cursor-pointer">
              💡 Idé
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <RadioGroupItem 
              value="problem" 
              id="option-problem" 
              {...register('feedbackType', { required: true })}
            />
            <Label htmlFor="option-problem" className="cursor-pointer">
              ⚠️ Problem
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <RadioGroupItem 
              value="other" 
              id="option-other" 
              {...register('feedbackType', { required: true })}
            />
            <Label htmlFor="option-other" className="cursor-pointer">
              💬 Andet
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="message" className="font-medium">
          Skriv din feedback<span className="text-red-500">*</span>
        </Label>
        <Textarea 
          id="message"
          placeholder="Din feedback..."
          className="h-32 resize-none"
          {...register('message', { 
            required: "Feedback er påkrævet" 
          })}
        />
        {errors.message && (
          <p className="text-sm text-red-500">{errors.message.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email" className="font-medium">
          Din e-mail (valgfrit)
        </Label>
        <p className="text-xs text-muted-foreground">
          Så vi kan svare dig tilbage
        </p>
        <Input 
          id="email"
          type="email"
          placeholder="din@email.dk"
          {...register('email', { 
            pattern: {
              value: /\S+@\S+\.\S+/,
              message: "Ugyldig e-mailadresse"
            }
          })}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>
      
      <Button 
        type="submit" 
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sender...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" /> Send feedback
          </>
        )}
      </Button>
    </form>
  );
};

export default FeedbackForm;
