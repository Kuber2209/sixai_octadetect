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

// This type should match the expected output from your new API route
export type PredictCancerRiskOutput = {
  riskAssessment: string;
  confidenceScore: number;
  cancerType: string;
  error?: string;
};


const MAX_FILE_SIZE = 5000000; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const CANCER_TYPES = ["Oral Cancer", "Cervical Cancer"];
const IMAGE_TYPES = ["Clinical", "Clinical and Radiograph", "Histopathology", "Radiograph"];

const formSchema = z.object({
  cancerType: z.string().min(1, "Please select a cancer type."),
  imageType: z.string().min(1, "Please select an image type."),
  image: z
    .any()
    .refine((files) => files?.length == 1, "Image is required.")
    .refine(
      (files) => files?.[0]?.size <= MAX_FILE_SIZE,
      `Max file size is 5MB.`
    )
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      ".jpg, .jpeg, and .png files are accepted."
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

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResult(null);
    try {
      const imageDataUri = await toBase64(values.image[0]);
      
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          imageDataUri: imageDataUri,
          imageType: values.imageType, // Pass the new imageType
        }),
      });

      const responseData: PredictCancerRiskOutput = await response.json();

      if (!response.ok || responseData.error) {
         toast({
          variant: "destructive",
          title: "Analysis Failed",
          description: responseData.error || "An unknown error occurred.",
        });
        setResult(responseData); // Still set result to show error in results-display
      } else {
        // Add cancerType to the result as it's not returned from the python function
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
      // Set the file in the form state
      form.setValue('image', e.target.files, { shouldValidate: true });
      // Create and set the image preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      form.setValue('image', null, { shouldValidate: true });
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
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      disabled={!form.watch("cancerType")}
                    />
                    {imagePreview ? (
                      <Image src={imagePreview} alt="Image preview" fill style={{objectFit: 'contain'}} className="rounded-lg p-2" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                        <Upload className="w-10 h-10 mb-2" />
                        <p className="text-sm font-semibold">Click to upload or drag & drop</p>
                        <p className="text-xs">JPG, PNG, JPEG (MAX. 5MB)</p>
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
