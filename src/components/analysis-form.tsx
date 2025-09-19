"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Upload } from "lucide-react";
import { analyzeMedicalDataForRisk, AnalyzeMedicalDataForRiskOutput } from "@/ai/flows/analyze-medical-data-for-risk";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ResultsDisplay } from "./results-display";
import Image from "next/image";

const MAX_FILE_SIZE = 5000000; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

const formSchema = z.object({
  age: z.coerce.number().min(1, "Age is required.").max(120, "Age must be between 1 and 120."),
  gender: z.enum(["Male", "Female", "Other"], { required_error: "Gender is required."}),
  smokingStatus: z.enum(["Never Smoked", "Former Smoker", "Current Smoker"], { required_error: "Smoking status is required." }),
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
  const [result, setResult] = useState<AnalyzeMedicalDataForRiskOutput | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      age: undefined,
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
      const response = await analyzeMedicalDataForRisk({
        imageDataUri,
        age: values.age,
        gender: values.gender,
        smokingStatus: values.smokingStatus,
      });
      setResult(response);
    } catch (error) {
      console.error("Analysis failed:", error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Also pass it to react-hook-form
      form.setValue("image", e.target.files, { shouldValidate: true });
    } else {
      setImagePreview(null);
      form.setValue("image", null, { shouldValidate: true });
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient Age</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 45" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="smokingStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Smoking Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select smoking status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Never Smoked">Never Smoked</SelectItem>
                        <SelectItem value="Former Smoker">Former Smoker</SelectItem>
                        <SelectItem value="Current Smoker">Current Smoker</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="image"
              render={() => (
                <FormItem>
                  <FormLabel>Medical Image</FormLabel>
                  <FormControl>
                    <label className="relative flex justify-center items-center w-full h-56 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Input
                        type="file"
                        className="absolute w-full h-full opacity-0 cursor-pointer"
                        accept={ACCEPTED_IMAGE_TYPES.join(",")}
                        onChange={handleImageChange}
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
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Analyze
          </Button>
        </form>
      </Form>
      {result && <ResultsDisplay result={result} />}
    </>
  );
}
