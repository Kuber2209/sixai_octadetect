"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ResultsDisplay } from "./results-display";
import Image from "next/image";

export type PredictCancerRiskOutput = {
  riskAssessment: string;
  confidenceScore: number;
  cancerType: string; // We'll add this back on the client-side
  error?: string;
};

const MAX_FILE_SIZE = 5000000; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg"];
const CANCER_TYPES = ["Oral Cancer", "Cervical Cancer"];
const IMAGE_TYPES = ["Clinical", "Clinical and Radiograph", "Histopathology", "Radiograph"];

const formSchema = z.object({
  cancerType: z.string().min(1, "Please select a cancer type."),
  imageType: z.string().min(1, "Please select an image type."),
  image: z
    .instanceof(File, { message: "Image is required." })
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      `Max file size is 5MB.`
    )
    .refine(
      (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpeg files are accepted."
    ),
});

export function AnalysisForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PredictCancerRiskOutput | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cancerType: "Oral Cancer",
      imageType: "Radiograph",
      image: undefined,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResult(null);

    const PREDICTION_API_URL = process.env.NEXT_PUBLIC_PREDICTION_API_URL;

    if (!PREDICTION_API_URL) {
      console.error('NEXT_PUBLIC_PREDICTION_API_URL is not set.');
      toast({
        variant: "destructive",
        title: "Configuration Error",
        description: "The prediction service URL is not configured.",
      });
      setIsLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', values.image);
      formData.append('image_type', values.imageType);
      
      const response = await fetch(PREDICTION_API_URL, {
        method: 'POST',
        body: formData, // Send as multipart/form-data
      });

      const responseData = await response.json();

      if (!response.ok || responseData.error) {
         toast({
          variant: "destructive",
          title: "Analysis Failed",
          description: responseData.error || "An unknown error occurred.",
        });
        setResult({
            riskAssessment: "",
            confidenceScore: 0,
            cancerType: values.cancerType,
            error: responseData.error || "An unknown error occurred.",
        });
      } else {
        setResult({ ...responseData, cancerType: values.cancerType });
      }

    } catch (error) {
      console.error("Analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue('image', file, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      form.setValue('image', undefined, { shouldValidate: true });
      setImagePreview(null);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cancerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cancer Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a cancer type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CANCER_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an image type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {IMAGE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
           </div>
           <p className="text-xs text-center text-muted-foreground -mt-2">Currently, only Oral Cancer analysis is supported.</p>
          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Medical Image</FormLabel>
                <FormControl>
                   <label className="relative flex justify-center items-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Input
                        type="file"
                        className="absolute w-full h-full opacity-0 cursor-pointer"
                        accept={ACCEPTED_IMAGE_TYPES.join(",")}
                        onChange={handleImageChange}
                        disabled={!form.watch("cancerType")}
                      />
                      {imagePreview ? (
                        <Image src={imagePreview} alt="Image preview" fill style={{objectFit: 'contain'}} className="rounded-lg p-2" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                          <Upload className="w-10 h-10 mb-2" />
                          <p className="text-sm font-semibold">Click to upload or drag & drop</p>
                          <p className="text-xs">JPEG only (MAX. 5MB)</p>
                        </div>
                      )}
                    </label>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="w-full" disabled={isLoading || !form.formState.isValid}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Analyze
          </Button>
        </form>
      </Form>
      {result && <ResultsDisplay result={result} />}
    </>
  );
}

    