'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRightIcon, CheckIcon, SparklesIcon, UsersIcon, PencilSquareIcon, BookOpenIcon, LightBulbIcon } from '@heroicons/react/24/outline';

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6 }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const scaleUp = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: { duration: 0.5 }
  }
};

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="w-full py-4 px-4 sm:px-6 lg:px-8 border-b border-border">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Image 
              src="/logo.svg" 
              alt="SermonFlow Logo" 
              width={40} 
              height={40}
              className="w-10 h-10"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              SermonFlow
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#benefits" className="text-muted-foreground hover:text-foreground transition-colors">
              Benefits
            </Link>
            <Link href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">
              Testimonials
            </Link>
          </nav>
          
          <div className="flex items-center space-x-4">
            <Link href="/auth/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Log in
            </Link>
            <Link 
              href="/auth/signup" 
              className="btn btn-primary btn-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden bg-gradient-to-b from-background to-secondary/20">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div 
                className="flex flex-col space-y-6"
                initial="hidden"
                animate="visible"
                variants={fadeIn}
              >
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
                  Write better sermons, <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">distraction-free</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-lg">
                  SermonFlow is the AI-powered writing platform designed specifically for pastors. Organize, write, and collaborate on your sermons with ease.
                </p>
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 pt-4">
                  <Link href="/auth/signup" className="btn btn-primary btn-lg">
                    Start Writing for Free
                    <ArrowRightIcon className="ml-2 h-5 w-5" />
                  </Link>
                  <Link href="#features" className="btn btn-outline btn-lg">
                    See How It Works
                  </Link>
                </div>
                <div className="pt-4 flex items-center text-sm text-muted-foreground">
                  <CheckIcon className="h-5 w-5 text-success mr-2" />
                  <span>Free 14-day trial • No credit card required</span>
                </div>
              </motion.div>
              
              <motion.div
                initial="hidden"
                animate="visible"
                variants={scaleUp}
                className="relative"
              >
                <div className="relative rounded-xl overflow-hidden shadow-2xl border border-border">
                  <Image
                    src="/dashboard-preview.png"
                    alt="SermonFlow Dashboard"
                    width={1200}
                    height={800}
                    className="w-full h-auto"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                
                {/* Floating elements for visual interest */}
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-xl"></div>
                <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-success/10 rounded-full blur-xl"></div>
              </motion.div>
            </div>
          </div>
          
          {/* Background decorations */}
          <div className="absolute top-1/2 left-0 w-full h-1/2 bg-grid-pattern-light dark:bg-grid-pattern-dark opacity-[0.15] pointer-events-none"></div>
        </section>
        
        {/* Trusted By Section */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-secondary/30">
          <div className="container mx-auto">
            <div className="text-center mb-8">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Trusted by pastors from
              </p>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-70">
              <Image src="/logos/church1.svg" alt="Church Logo" width={120} height={40} className="h-8 w-auto" />
              <Image src="/logos/church2.svg" alt="Church Logo" width={120} height={40} className="h-8 w-auto" />
              <Image src="/logos/church3.svg" alt="Church Logo" width={120} height={40} className="h-8 w-auto" />
              <Image src="/logos/church4.svg" alt="Church Logo" width={120} height={40} className="h-8 w-auto" />
              <Image src="/logos/church5.svg" alt="Church Logo" width={120} height={40} className="h-8 w-auto" />
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <motion.div 
              className="text-center max-w-3xl mx-auto mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeIn}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Powerful tools for sermon preparation
              </h2>
              <p className="text-xl text-muted-foreground">
                Everything you need to create impactful sermons, from initial inspiration to final delivery.
              </p>
            </motion.div>
            
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              {/* Feature 1 */}
              <motion.div 
                className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow"
                variants={fadeIn}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <PencilSquareIcon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Distraction-Free Editor</h3>
                <p className="text-muted-foreground">
                  Focus on your message with our clean, hierarchical sermon editor designed specifically for sermon writing.
                </p>
              </motion.div>
              
              {/* Feature 2 */}
              <motion.div 
                className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow"
                variants={fadeIn}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <SparklesIcon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">AI Research Assistant</h3>
                <p className="text-muted-foreground">
                  Get instant access to scripture references, commentaries, illustrations, and theological insights powered by AI.
                </p>
              </motion.div>
              
              {/* Feature 3 */}
              <motion.div 
                className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow"
                variants={fadeIn}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <UsersIcon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Real-Time Collaboration</h3>
                <p className="text-muted-foreground">
                  Work together with your team in real-time with comments, suggestions, and collaborative editing.
                </p>
              </motion.div>
              
              {/* Feature 4 */}
              <motion.div 
                className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow"
                variants={fadeIn}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <BookOpenIcon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Sermon Series Management</h3>
                <p className="text-muted-foreground">
                  Organize your sermons into series with our intuitive Kanban-style dashboard for better planning and continuity.
                </p>
              </motion.div>
              
              {/* Feature 5 */}
              <motion.div 
                className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow"
                variants={fadeIn}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <LightBulbIcon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Template Library</h3>
                <p className="text-muted-foreground">
                  Start quickly with customizable sermon templates for different styles, occasions, and sermon structures.
                </p>
              </motion.div>
              
              {/* Feature 6 */}
              <motion.div 
                className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow"
                variants={fadeIn}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3">Secure & Private</h3>
                <p className="text-muted-foreground">
                  Your sermons are kept secure and private with end-to-end encryption and granular permission controls.
                </p>
              </motion.div>
            </motion.div>
            
            <div className="mt-16 text-center">
              <Link href="/auth/signup" className="btn btn-primary btn-lg">
                Try All Features Free
              </Link>
            </div>
          </div>
        </section>
        
        {/* Benefits Section */}
        <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
          <div className="container mx-auto">
            <motion.div 
              className="text-center max-w-3xl mx-auto mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeIn}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Designed for pastors, by pastors
              </h2>
              <p className="text-xl text-muted-foreground">
                SermonFlow helps you save time, improve your sermon quality, and reduce stress in your weekly preparation.
              </p>
            </motion.div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div 
                className="order-2 lg:order-1"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={fadeIn}
              >
                <ul className="space-y-6">
                  <li className="flex">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mr-4">
                      <CheckIcon className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-1">Save 5+ hours every week</h3>
                      <p className="text-muted-foreground">
                        Streamline your sermon preparation process with AI research assistance and intuitive organization tools.
                      </p>
                    </div>
                  </li>
                  
                  <li className="flex">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mr-4">
                      <CheckIcon className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-1">Improve sermon quality</h3>
                      <p className="text-muted-foreground">
                        Access deeper theological insights, better illustrations, and more scripture connections to enrich your message.
                      </p>
                    </div>
                  </li>
                  
                  <li className="flex">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mr-4">
                      <CheckIcon className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-1">Reduce preparation stress</h3>
                      <p className="text-muted-foreground">
                        Start your sermon preparation with confidence using our structured templates and organization system.
                      </p>
                    </div>
                  </li>
                  
                  <li className="flex">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mr-4">
                      <CheckIcon className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-1">Build sermon series continuity</h3>
                      <p className="text-muted-foreground">
                        Create cohesive sermon series with our Kanban board planning system and series management tools.
                      </p>
                    </div>
                  </li>
                </ul>
              </motion.div>
              
              <motion.div 
                className="order-1 lg:order-2 relative"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={scaleUp}
              >
                <div className="relative rounded-xl overflow-hidden shadow-2xl border border-border">
                  <Image
                    src="/editor-preview.png"
                    alt="SermonFlow Editor"
                    width={1200}
                    height={800}
                    className="w-full h-auto"
                  />
                </div>
                
                {/* Decorative elements */}
                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-primary/10 rounded-full blur-xl"></div>
              </motion.div>
            </div>
          </div>
        </section>
        
        {/* Testimonials Section */}
        <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <motion.div 
              className="text-center max-w-3xl mx-auto mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeIn}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Loved by pastors everywhere
              </h2>
              <p className="text-xl text-muted-foreground">
                See what other ministry leaders are saying about SermonFlow
              </p>
            </motion.div>
            
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              {/* Testimonial 1 */}
              <motion.div 
                className="bg-card rounded-xl p-6 border border-border shadow-sm"
                variants={fadeIn}
              >
                <div className="flex items-center mb-4">
                  <div className="flex text-primary">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <blockquote className="text-foreground mb-4">
                  "SermonFlow has revolutionized my sermon preparation. The AI research assistant saves me hours of study time, and the organization tools help me stay focused and productive."
                </blockquote>
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                    <span className="text-primary font-semibold">JM</span>
                  </div>
                  <div>
                    <p className="font-medium">Pastor John Miller</p>
                    <p className="text-sm text-muted-foreground">Grace Community Church</p>
                  </div>
                </div>
              </motion.div>
              
              {/* Testimonial 2 */}
              <motion.div 
                className="bg-card rounded-xl p-6 border border-border shadow-sm"
                variants={fadeIn}
              >
                <div className="flex items-center mb-4">
                  <div className="flex text-primary">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <blockquote className="text-foreground mb-4">
                  "As a teaching pastor, I love how SermonFlow helps our team collaborate on sermon series. The real-time editing and commenting features have improved our communication and sermon quality."
                </blockquote>
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                    <span className="text-primary font-semibold">SR</span>
                  </div>
                  <div>
                    <p className="font-medium">Dr. Sarah Rodriguez</p>
                    <p className="text-sm text-muted-foreground">Hillside Fellowship</p>
                  </div>
                </div>
              </motion.div>
              
              {/* Testimonial 3 */}
              <motion.div 
                className="bg-card rounded-xl p-6 border border-border shadow-sm"
                variants={fadeIn}
              >
                <div className="flex items-center mb-4">
                  <div className="flex text-primary">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <blockquote className="text-foreground mb-4">
                  "The template library and hierarchical block structure have transformed how I organize my thoughts. I'm preaching with more clarity and confidence thanks to SermonFlow."
                </blockquote>
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                    <span className="text-primary font-semibold">DW</span>
                  </div>
                  <div>
                    <p className="font-medium">Pastor David Wilson</p>
                    <p className="text-sm text-muted-foreground">New Life Church</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary/5 border-y border-border">
          <div className="container mx-auto">
            <motion.div 
              className="max-w-4xl mx-auto text-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeIn}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Ready to transform your sermon preparation?
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of pastors who are saving time, reducing stress, and creating more impactful sermons with SermonFlow.
              </p>
              <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                <Link href="/auth/signup" className="btn btn-primary btn-lg">
                  Start Your Free Trial
                </Link>
                <Link href="#features" className="btn btn-outline btn-lg">
                  Learn More
                </Link>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                No credit card required • 14-day free trial • Cancel anytime
              </p>
            </motion.div>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center space-x-2">
                <Image 
                  src="/logo.svg" 
                  alt="SermonFlow Logo" 
                  width={32} 
                  height={32}
                  className="w-8 h-8"
                />
                <span className="text-xl font-bold">SermonFlow</span>
              </Link>
              <p className="mt-4 text-sm text-muted-foreground">
                A distraction-free, AI-powered sermon-writing application for pastors.
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider">Product</h3>
              <ul className="mt-4 space-y-2">
                <li><Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="#benefits" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Benefits</Link></li>
                <li><Link href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Testimonials</Link></li>
                <li><Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider">Resources</h3>
              <ul className="mt-4 space-y-2">
                <li><Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="/help" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Help Center</Link></li>
                <li><Link href="/guides" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Guides</Link></li>
                <li><Link href="/templates" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Templates</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider">Company</h3>
              <ul className="mt-4 space-y-2">
                <li><Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
                <li><Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} SermonFlow. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="sr-only">GitHub</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="sr-only">Instagram</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
