'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ClockIcon,
  DocumentTextIcon,
  CalendarIcon,
  UserGroupIcon,
  BookOpenIcon,
  PencilSquareIcon,
  FolderPlusIcon,
  DocumentPlusIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { SeriesStatus, SermonStatus } from '@sermonflow/types';
import toast from 'react-hot-toast';

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4 }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Mock data for series
const mockSeries = [
  {
    id: 'series-1',
    title: 'The Beatitudes',
    description: 'Exploring the teachings of Jesus from the Sermon on the Mount',
    status: 'IN_PROGRESS',
    sermonCount: 4,
    coverImageUrl: '/series/beatitudes.jpg',
    startDate: new Date('2023-10-01'),
    endDate: new Date('2023-10-29'),
    progress: 50,
  },
  {
    id: 'series-2',
    title: 'Faith That Works',
    description: 'A journey through the book of James',
    status: 'DRAFT',
    sermonCount: 6,
    coverImageUrl: '/series/james.jpg',
    startDate: new Date('2023-11-05'),
    endDate: new Date('2023-12-10'),
    progress: 25,
  },
  {
    id: 'series-3',
    title: 'Christmas: The Gift',
    description: 'Celebrating the gift of Christ during the Christmas season',
    status: 'DRAFT',
    sermonCount: 3,
    coverImageUrl: '/series/christmas.jpg',
    startDate: new Date('2023-12-17'),
    endDate: new Date('2023-12-31'),
    progress: 10,
  },
  {
    id: 'series-4',
    title: 'Psalms of Hope',
    description: 'Finding hope and comfort in the Psalms',
    status: 'COMPLETED',
    sermonCount: 5,
    coverImageUrl: '/series/psalms.jpg',
    startDate: new Date('2023-09-03'),
    endDate: new Date('2023-10-01'),
    progress: 100,
  },
];

// Mock data for recent activity
const mockActivity = [
  {
    id: 'activity-1',
    type: 'sermon_edit',
    title: 'The Power of Grace',
    seriesTitle: 'The Beatitudes',
    timestamp: new Date('2023-10-15T14:32:00'),
    user: 'You'
  },
  {
    id: 'activity-2',
    type: 'comment',
    title: 'Faith and Works',
    seriesTitle: 'Faith That Works',
    timestamp: new Date('2023-10-14T09:45:00'),
    user: 'Pastor Sarah'
  },
  {
    id: 'activity-3',
    type: 'series_create',
    title: 'Christmas: The Gift',
    seriesTitle: 'Christmas: The Gift',
    timestamp: new Date('2023-10-12T16:20:00'),
    user: 'You'
  },
  {
    id: 'activity-4',
    type: 'sermon_share',
    title: 'Finding Peace in Chaos',
    seriesTitle: 'Psalms of Hope',
    timestamp: new Date('2023-10-10T11:15:00'),
    user: 'You'
  },
];

// Mock data for sermon statistics
const mockStats = {
  totalSermons: 18,
  totalSeries: 4,
  sermonsThisMonth: 3,
  averagePreparationTime: '5.2 hours',
  upcomingSermon: {
    title: 'Blessed Are The Peacemakers',
    date: new Date('2023-10-22'),
    series: 'The Beatitudes'
  }
};

// Dashboard component
export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [series, setSeries] = useState(mockSeries);
  const [activity, setActivity] = useState(mockActivity);
  const [stats, setStats] = useState(mockStats);
  const [showFilters, setShowFilters] = useState(false);
  
  // Simulate loading data
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Filter series based on search query and status filter
  const filteredSeries = series.filter(s => {
    const matchesSearch = searchQuery === '' || 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === null || s.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  // Group series by status for Kanban board
  const seriesByStatus = {
    DRAFT: filteredSeries.filter(s => s.status === 'DRAFT'),
    IN_PROGRESS: filteredSeries.filter(s => s.status === 'IN_PROGRESS'),
    REVIEW: filteredSeries.filter(s => s.status === 'REVIEW'),
    FINALIZED: filteredSeries.filter(s => s.status === 'FINALIZED'),
    COMPLETED: filteredSeries.filter(s => s.status === 'COMPLETED'),
  };
  
  // Handle drag and drop
  const handleDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;
    
    // If dropped outside a droppable area
    if (!destination) return;
    
    // If dropped in the same place
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return;
    
    // Find the series being dragged
    const draggedSeries = series.find(s => s.id === draggableId);
    if (!draggedSeries) return;
    
    // Create a new series array with the updated status
    const newSeries = series.map(s => {
      if (s.id === draggableId) {
        return {
          ...s,
          status: destination.droppableId as SeriesStatus
        };
      }
      return s;
    });
    
    // Update the state
    setSeries(newSeries);
    
    // Show success toast
    toast.success(`"${draggedSeries.title}" moved to ${destination.droppableId.replace('_', ' ').toLowerCase()}`);
    
    // In a real app, you would also update the backend
  };
  
  // Handle creating a new series
  const handleCreateSeries = () => {
    router.push('/series/new');
  };
  
  // Handle creating a new sermon
  const handleCreateSermon = () => {
    router.push('/sermons/new');
  };
  
  // Format date for display
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };
  
  // Format time ago for activity
  const timeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    return formatDate(date);
  };
  
  // Get activity icon based on type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sermon_edit':
        return <PencilSquareIcon className="h-5 w-5 text-blue-500" />;
      case 'comment':
        return <DocumentTextIcon className="h-5 w-5 text-amber-500" />;
      case 'series_create':
        return <FolderPlusIcon className="h-5 w-5 text-green-500" />;
      case 'sermon_share':
        return <UserGroupIcon className="h-5 w-5 text-purple-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'REVIEW':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'FINALIZED':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };
  
  // Get status label
  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };
  
  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-lg text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-destructive/10 border border-destructive/30 text-destructive p-6 rounded-lg max-w-md">
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        {/* Welcome header */}
        <motion.div 
          className="mb-8"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.firstName || 'Pastor'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </motion.div>
        
        {/* Quick actions */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={fadeIn}>
            <button 
              onClick={handleCreateSermon}
              className="w-full h-full bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg p-4 flex items-center transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center mr-3">
                <DocumentPlusIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-medium">New Sermon</h3>
                <p className="text-sm text-muted-foreground">Create from scratch</p>
              </div>
            </button>
          </motion.div>
          
          <motion.div variants={fadeIn}>
            <button 
              onClick={handleCreateSeries}
              className="w-full h-full bg-secondary hover:bg-secondary/80 border border-border rounded-lg p-4 flex items-center transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center mr-3">
                <FolderPlusIcon className="h-5 w-5 text-foreground" />
              </div>
              <div className="text-left">
                <h3 className="font-medium">New Series</h3>
                <p className="text-sm text-muted-foreground">Plan a sermon series</p>
              </div>
            </button>
          </motion.div>
          
          <motion.div variants={fadeIn}>
            <button 
              onClick={() => router.push('/templates')}
              className="w-full h-full bg-secondary hover:bg-secondary/80 border border-border rounded-lg p-4 flex items-center transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center mr-3">
                <BookOpenIcon className="h-5 w-5 text-foreground" />
              </div>
              <div className="text-left">
                <h3 className="font-medium">Templates</h3>
                <p className="text-sm text-muted-foreground">Start from a template</p>
              </div>
            </button>
          </motion.div>
          
          <motion.div variants={fadeIn}>
            <button 
              onClick={() => router.push('/research')}
              className="w-full h-full bg-secondary hover:bg-secondary/80 border border-border rounded-lg p-4 flex items-center transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center mr-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-foreground" />
              </div>
              <div className="text-left">
                <h3 className="font-medium">Research</h3>
                <p className="text-sm text-muted-foreground">AI-powered research</p>
              </div>
            </button>
          </motion.div>
        </motion.div>
        
        {/* Dashboard content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content - Kanban board */}
          <div className="lg:col-span-2 space-y-6">
            {/* Series header with search and filters */}
            <motion.div 
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <h2 className="text-2xl font-semibold">Your Sermon Series</h2>
              
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Search input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search series..."
                    className="form-input pl-10 py-2 w-full sm:w-auto"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                {/* Filter button */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="btn btn-outline flex items-center"
                >
                  <AdjustmentsHorizontalIcon className="h-5 w-5 mr-1" />
                  Filters
                  <ChevronDownIcon className={`h-4 w-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </motion.div>
            
            {/* Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-card border border-border rounded-lg p-4 overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setStatusFilter(null)}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        statusFilter === null 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      All
                    </button>
                    {Object.keys(SeriesStatus).map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          statusFilter === status 
                            ? 'bg-primary text-primary-foreground' 
                            : getStatusColor(status)
                        }`}
                      >
                        {getStatusLabel(status)}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Kanban board */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Draft column */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Draft ({seriesByStatus.DRAFT.length})
                  </h3>
                  
                  <Droppable droppableId="DRAFT">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="bg-secondary/30 rounded-lg min-h-[200px] p-2"
                      >
                        <AnimatePresence>
                          {seriesByStatus.DRAFT.map((series, index) => (
                            <Draggable
                              key={series.id}
                              draggableId={series.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <motion.div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                                  className={`bg-card border border-border rounded-lg mb-2 p-3 shadow-sm ${
                                    snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                                  }`}
                                  style={{
                                    ...provided.draggableProps.style,
                                  }}
                                  onClick={() => router.push(`/series/${series.id}`)}
                                >
                                  <h4 className="font-medium mb-1 line-clamp-1">{series.title}</h4>
                                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{series.description}</p>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">{series.sermonCount} sermons</span>
                                    <span className={`px-2 py-0.5 rounded-full ${getStatusColor(series.status)}`}>
                                      {getStatusLabel(series.status)}
                                    </span>
                                  </div>
                                </motion.div>
                              )}
                            </Draggable>
                          ))}
                        </AnimatePresence>
                        {provided.placeholder}
                        
                        {seriesByStatus.DRAFT.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                            <p className="text-sm text-muted-foreground mb-2">No draft series</p>
                            <button
                              onClick={handleCreateSeries}
                              className="btn btn-sm btn-outline flex items-center"
                            >
                              <PlusIcon className="h-4 w-4 mr-1" />
                              Create Series
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
                
                {/* In Progress column */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    In Progress ({seriesByStatus.IN_PROGRESS.length})
                  </h3>
                  
                  <Droppable droppableId="IN_PROGRESS">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="bg-secondary/30 rounded-lg min-h-[200px] p-2"
                      >
                        <AnimatePresence>
                          {seriesByStatus.IN_PROGRESS.map((series, index) => (
                            <Draggable
                              key={series.id}
                              draggableId={series.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <motion.div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                                  className={`bg-card border border-border rounded-lg mb-2 p-3 shadow-sm ${
                                    snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                                  }`}
                                  style={{
                                    ...provided.draggableProps.style,
                                  }}
                                  onClick={() => router.push(`/series/${series.id}`)}
                                >
                                  <h4 className="font-medium mb-1 line-clamp-1">{series.title}</h4>
                                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{series.description}</p>
                                  <div className="w-full bg-secondary rounded-full h-1.5 mb-2">
                                    <div 
                                      className="bg-primary h-1.5 rounded-full"
                                      style={{ width: `${series.progress}%` }}
                                    ></div>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">{series.progress}% complete</span>
                                    <span className={`px-2 py-0.5 rounded-full ${getStatusColor(series.status)}`}>
                                      {getStatusLabel(series.status)}
                                    </span>
                                  </div>
                                </motion.div>
                              )}
                            </Draggable>
                          ))}
                        </AnimatePresence>
                        {provided.placeholder}
                        
                        {seriesByStatus.IN_PROGRESS.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                            <p className="text-sm text-muted-foreground">No series in progress</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
                
                {/* Completed column */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Completed ({seriesByStatus.COMPLETED.length})
                  </h3>
                  
                  <Droppable droppableId="COMPLETED">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="bg-secondary/30 rounded-lg min-h-[200px] p-2"
                      >
                        <AnimatePresence>
                          {seriesByStatus.COMPLETED.map((series, index) => (
                            <Draggable
                              key={series.id}
                              draggableId={series.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <motion.div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                                  className={`bg-card border border-border rounded-lg mb-2 p-3 shadow-sm ${
                                    snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                                  }`}
                                  style={{
                                    ...provided.draggableProps.style,
                                  }}
                                  onClick={() => router.push(`/series/${series.id}`)}
                                >
                                  <h4 className="font-medium mb-1 line-clamp-1">{series.title}</h4>
                                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{series.description}</p>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">
                                      {formatDate(series.startDate)} - {formatDate(series.endDate)}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full ${getStatusColor(series.status)}`}>
                                      {getStatusLabel(series.status)}
                                    </span>
                                  </div>
                                </motion.div>
                              )}
                            </Draggable>
                          ))}
                        </AnimatePresence>
                        {provided.placeholder}
                        
                        {seriesByStatus.COMPLETED.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                            <p className="text-sm text-muted-foreground">No completed series</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            </DragDropContext>
          </div>
          
          {/* Sidebar - Stats and activity */}
          <div className="space-y-6">
            {/* Stats */}
            <motion.div 
              className="bg-card border border-border rounded-lg overflow-hidden shadow-sm"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <div className="p-4 border-b border-border">
                <h3 className="font-medium">Your Stats</h3>
              </div>
              
              <div className="grid grid-cols-2 divide-x divide-y divide-border">
                <div className="p-4 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{stats.totalSermons}</span>
                  <span className="text-sm text-muted-foreground">Total Sermons</span>
                </div>
                <div className="p-4 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{stats.totalSeries}</span>
                  <span className="text-sm text-muted-foreground">Sermon Series</span>
                </div>
                <div className="p-4 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{stats.sermonsThisMonth}</span>
                  <span className="text-sm text-muted-foreground">This Month</span>
                </div>
                <div className="p-4 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{stats.averagePreparationTime}</span>
                  <span className="text-sm text-muted-foreground">Avg. Prep Time</span>
                </div>
              </div>
              
              {/* Next sermon */}
              <div className="p-4 border-t border-border bg-secondary/30">
                <h4 className="text-sm font-medium mb-2">Upcoming Sermon</h4>
                <div className="flex items-center">
                  <CalendarIcon className="h-10 w-10 text-primary mr-3" />
                  <div>
                    <p className="font-medium">{stats.upcomingSermon.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(stats.upcomingSermon.date)} • {stats.upcomingSermon.series}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Recent activity */}
            <motion.div 
              className="bg-card border border-border rounded-lg overflow-hidden shadow-sm"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <div className="p-4 border-b border-border flex justify-between items-center">
                <h3 className="font-medium">Recent Activity</h3>
                <button 
                  className="text-sm text-primary hover:text-primary/80 flex items-center"
                  onClick={() => setActivity([...activity])} // Refresh activity (would fetch from API in real app)
                >
                  <ArrowPathIcon className="h-4 w-4 mr-1" />
                  Refresh
                </button>
              </div>
              
              <div className="divide-y divide-border">
                {activity.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-secondary/30 transition-colors">
                    <div className="flex">
                      <div className="flex-shrink-0 mr-3">
                        {getActivityIcon(item.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.seriesTitle} • {item.user}
                        </p>
                      </div>
                      <div className="flex-shrink-0 whitespace-nowrap text-sm text-muted-foreground">
                        {timeAgo(item.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-border bg-secondary/30 text-center">
                <button 
                  className="text-sm text-primary hover:text-primary/80"
                  onClick={() => router.push('/activity')}
                >
                  View All Activity
                </button>
              </div>
            </motion.div>
            
            {/* Quick stats */}
            <motion.div 
              className="grid grid-cols-2 gap-4"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div 
                variants={fadeIn}
                className="bg-card border border-border rounded-lg p-4 flex flex-col items-center justify-center shadow-sm"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <ChartBarIcon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-2xl font-bold">18</span>
                <span className="text-sm text-muted-foreground">Total Sermons</span>
              </motion.div>
              
              <motion.div 
                variants={fadeIn}
                className="bg-card border border-border rounded-lg p-4 flex flex-col items-center justify-center shadow-sm"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <ClockIcon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-2xl font-bold">5.2h</span>
                <span className="text-sm text-muted-foreground">Avg. Prep Time</span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
