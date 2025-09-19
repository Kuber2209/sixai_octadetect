export function About() {
  return (
    <section id="about" className="w-full py-16 md:py-24 lg:py-32 bg-secondary/30">
      <div className="container px-4 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <h2 className="text-3xl font-bold font-headline tracking-tighter sm:text-4xl">
            About OncoAI
          </h2>
          <p className="text-muted-foreground md:text-xl/relaxed">
            OncoAI is a revolutionary tool at the intersection of
            artificial intelligence and healthcare. Our mission is to provide an
            accessible, reliable, and user-friendly platform for the early
            detection of various forms of cancer. By leveraging
            state-of-the-art machine learning models, we analyze medical images
            and clinical data to provide risk assessments, empowering
            healthcare professionals and patients to make informed decisions and
            improve outcomes.
          </p>
          <p className="text-muted-foreground md:text-xl/relaxed">
            Our team comprises dedicated engineers, data scientists, and medical
            advisors committed to pushing the boundaries of what's possible in
            medical diagnostics. We believe that technology can be a powerful
            ally in the fight against cancer, and early detection is the key to
            a better future.
          </p>
        </div>
      </div>
    </section>
  );
}
