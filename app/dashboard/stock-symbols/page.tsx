"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { isAuthenticated } from "@/lib/auth";
import {
  fetchStockSymbols,
  createStockSymbol,
  updateStockSymbol,
  deleteStockSymbol,
  searchStockSymbols,
  updateStockPrices,
  type StockSymbol,
  type CreateStockSymbolRequest,
  type StockSymbolsResponse,
} from "@/lib/api-stock-symbols";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StockSymbolFormDialog } from "@/components/stock-symbol-form-dialog";
import { StockSearch } from "@/components/stock-search";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Database,
  Activity,
  Clock,
  Wifi,
  WifiOff,
  Settings,
  Pause,
  Play,
} from "lucide-react";

// Real-time configuration
const REFRESH_INTERVALS = {
  '5': { label: '5 seconds', value: 5000 },
  '10': { label: '10 seconds', value: 10000 },
  '30': { label: '30 seconds', value: 30000 },
  '60': { label: '1 minute', value: 60000 },
  '300': { label: '5 minutes', value: 300000 },
} as const;

type RefreshInterval = keyof typeof REFRESH_INTERVALS;

export default function StockSymbolsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [stockSymbols, setStockSymbols] = useState<StockSymbol[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSymbol[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });
  
  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<StockSymbol | null>(null);
  
  // Live stock search states
  const [selectedLiveStock, setSelectedLiveStock] = useState<StockSymbol | null>(null);
  const [showLiveSearch, setShowLiveSearch] = useState(false);
  
  // Authentication and error states
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // Real-time update states
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>('30');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [showRealTimeSettings, setShowRealTimeSettings] = useState(false);
  const [updateCounter, setUpdateCounter] = useState(0);
  
  // Refs for real-time functionality
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<Date | null>(null);

  // Check authentication on component mount
  useEffect(() => {
    try {
      const authStatus = isAuthenticated();
      setIsUserAuthenticated(authStatus);

      if (authStatus) {
        loadStockSymbols();
      } else {
        setError("You need to log in to access this page.");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error checking authentication:", error);
      setIsUserAuthenticated(false);
      setError("Error checking authentication status. Please try logging in again.");
      setIsLoading(false);
    }
  }, []);

  // Real-time updates effect
  useEffect(() => {
    if (isRealTimeEnabled && isUserAuthenticated) {
      startRealTimeUpdates();
    } else {
      stopRealTimeUpdates();
    }

    return () => stopRealTimeUpdates();
  }, [isRealTimeEnabled, refreshInterval, isUserAuthenticated]);

  const startRealTimeUpdates = () => {
    stopRealTimeUpdates(); // Clear any existing interval
    
    const interval = REFRESH_INTERVALS[refreshInterval].value;
    intervalRef.current = setInterval(async () => {
      try {
        await refreshStockData();
        setIsConnected(true);
      } catch (error) {
        console.error("Real-time update failed:", error);
        setIsConnected(false);
        // Continue trying to update, don't disable real-time mode
      }
    }, interval);
  };

  const stopRealTimeUpdates = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const refreshStockData = async () => {
    try {
      const now = new Date();
      const response: StockSymbolsResponse = await fetchStockSymbols(pagination.page, pagination.limit);
      
      setStockSymbols(response.data);
      if (response.pagination) {
        setPagination(response.pagination);
      }
      
      setLastUpdateTime(now);
      lastUpdateRef.current = now;
      setUpdateCounter(prev => prev + 1);
      
      // Show subtle update indicator
      if (updateCounter > 0) {
        toast({
          title: "Data Updated",
          description: `Stock prices refreshed at ${now.toLocaleTimeString()}`,
          duration: 2000,
        });
      }
    } catch (error) {
      console.error("Error refreshing stock data:", error);
      throw error;
    }
  };

  const loadStockSymbols = async (page: number = 1, limit: number = 50) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("Fetching stock symbols...");
      const response: StockSymbolsResponse = await fetchStockSymbols(page, limit);
      console.log(`Loaded ${response.data.length} stock symbols:`, response);
      
      setStockSymbols(response.data);
      if (response.pagination) {
        setPagination(response.pagination);
      }
      
      const now = new Date();
      setLastUpdateTime(now);
      lastUpdateRef.current = now;
      setIsConnected(true);
    } catch (error) {
      console.error("Error loading stock symbols:", error);
      setError(error instanceof Error ? error.message : "Failed to load stock symbols");
      setIsConnected(false);
      
      toast({
        title: "Error loading stock symbols",
        description: error instanceof Error ? error.message : "Failed to load stock symbols",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (term: string) => {
      if (term.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchStockSymbols(term);
        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
        toast({
          title: "Search Error",
          description: error instanceof Error ? error.message : "Failed to search stock symbols",
          variant: "destructive",
        });
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [toast]
  );

  // Effect to trigger search when searchQuery changes
  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, debouncedSearch]);

  const handleAddFromLiveSearch = (symbol: string, stockDetails: StockSymbol) => {
    setSelectedLiveStock(stockDetails);
    // Check if stock already exists in our database
    const existingStock = stockSymbols.find(stock => stock.symbol === symbol);
    if (existingStock) {
      toast({
        title: "Stock Already Exists",
        description: `${symbol} is already in the database. You can edit it instead.`,
        variant: "default",
      });
      setSelectedStockSymbol(existingStock);
      setIsEditDialogOpen(true);
      return;
    }
    
    // Auto-fill the add dialog with live data
    setIsAddDialogOpen(true);
  };

  const handleAddStockSymbol = async (stockData: CreateStockSymbolRequest) => {
    try {
      console.log("Creating stock symbol with data:", stockData);
      await createStockSymbol(stockData);

      toast({
        title: "Success",
        description: "Stock symbol created successfully",
      });

      // Clear live selection
      setSelectedLiveStock(null);
      
      // Reload the list
      await loadStockSymbols(pagination.page, pagination.limit);
      setIsAddDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      
      toast({
        title: "Error",
        description: `Failed to create stock symbol: ${errorMessage}`,
        variant: "destructive",
      });
      throw error; // Re-throw to be handled by the form dialog
    }
  };

  const handleEditStockSymbol = async (stockData: CreateStockSymbolRequest) => {
    if (!selectedStockSymbol) return;

    try {
      const id = selectedStockSymbol._id || selectedStockSymbol.id;
      if (!id) {
        throw new Error("Stock symbol ID is missing");
      }

      console.log(`Updating stock symbol ${id}:`, stockData);
      await updateStockSymbol(id, stockData);

      toast({
        title: "Success",
        description: "Stock symbol updated successfully",
      });

      // Reload the list
      await loadStockSymbols(pagination.page, pagination.limit);
      setIsEditDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      
      toast({
        title: "Error",
        description: `Failed to update stock symbol: ${errorMessage}`,
        variant: "destructive",
      });
      throw error; // Re-throw to be handled by the form dialog
    }
  };

  const handleDeleteStockSymbol = async () => {
    if (!selectedStockSymbol) return;

    try {
      const id = selectedStockSymbol._id || selectedStockSymbol.id;
      if (!id) {
        throw new Error("Stock symbol ID is missing");
      }

      await deleteStockSymbol(id);

      toast({
        title: "Success",
        description: "Stock symbol deleted successfully",
      });

      setIsDeleteDialogOpen(false);
      // Reload the list
      await loadStockSymbols(pagination.page, pagination.limit);
    } catch (error) {
      console.error("Error deleting stock symbol:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete stock symbol",
        variant: "destructive",
      });
    }
  };

  const handleUpdateAllPrices = async () => {
    setIsUpdatingPrices(true);
    try {
      const result = await updateStockPrices();
      
      toast({
        title: "Price Update Complete",
        description: `Updated ${result.updated} symbols, ${result.failed} failed`,
        variant: result.failed > 0 ? "default" : "default",
      });

      // Reload the list to show updated prices
      await loadStockSymbols(pagination.page, pagination.limit);
    } catch (error) {
      console.error("Error updating prices:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update stock prices",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const handleLogin = () => {
    router.push('/login');
  };

  // Price change calculations
  const getPriceChangeColor = (current: string, previous: string) => {
    const currentPrice = parseFloat(current);
    const previousPrice = parseFloat(previous);
    
    if (currentPrice > previousPrice) return "text-green-500";
    if (currentPrice < previousPrice) return "text-red-500";
    return "text-zinc-400";
  };

  const getPriceChangeIcon = (current: string, previous: string) => {
    const currentPrice = parseFloat(current);
    const previousPrice = parseFloat(previous);
    
    if (currentPrice > previousPrice) return <TrendingUp className="h-3 w-3" />;
    if (currentPrice < previousPrice) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const calculatePriceChange = (current: string, previous: string) => {
    const currentPrice = parseFloat(current);
    const previousPrice = parseFloat(previous);
    const change = currentPrice - previousPrice;
    const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
    
    return {
      absolute: change.toFixed(2),
      percent: changePercent.toFixed(2),
    };
  };

  const formatLastUpdateTime = () => {
    if (!lastUpdateTime) return "Never";
    
    const now = new Date();
    const diffMs = now.getTime() - lastUpdateTime.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    return lastUpdateTime.toLocaleTimeString();
  };

  // Define columns for the data table
  const columns: ColumnDef<StockSymbol>[] = [
    {
      accessorKey: "symbol",
      header: "Symbol",
      cell: ({ row }) => (
        <div className="font-mono font-bold text-white flex items-center gap-2">
          {row.original.symbol}
          {isRealTimeEnabled && (
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live data enabled" />
          )}
        </div>
      ),
    },
    {
      accessorKey: "name",
      header: "Company Name",
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate text-zinc-300">
          {row.original.name}
        </div>
      ),
    },
    {
      accessorKey: "exchange",
      header: "Exchange",
      cell: ({ row }) => (
        <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-600">
          {row.original.exchange}
        </Badge>
      ),
    },
    {
      accessorKey: "currentPrice",
      header: "Current Price",
      cell: ({ row }) => (
        <div className="font-medium text-white">
          ₹{parseFloat(row.original.currentPrice).toLocaleString()}
        </div>
      ),
    },
    {
      accessorKey: "priceChange",
      header: "Change",
      cell: ({ row }) => {
        const change = calculatePriceChange(row.original.currentPrice, row.original.previousPrice);
        const colorClass = getPriceChangeColor(row.original.currentPrice, row.original.previousPrice);
        
        return (
          <div className={`flex items-center gap-1 text-sm ${colorClass}`}>
            {getPriceChangeIcon(row.original.currentPrice, row.original.previousPrice)}
            <span>{change.absolute}</span>
            <span>({change.percent}%)</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-zinc-800"
            onClick={() => {
              setSelectedStockSymbol(row.original);
              setIsEditDialogOpen(true);
            }}
          >
            <Edit className="h-4 w-4 text-zinc-400" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setSelectedStockSymbol(row.original);
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-zinc-400" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  if (!isUserAuthenticated) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive" className="border-destructive/50 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Error</AlertTitle>
          <AlertDescription>
            {error || "You need to log in to access this page."}
          </AlertDescription>
        </Alert>
        <Button onClick={handleLogin}>Log In</Button>
      </div>
    );
  }

  const displayData = searchQuery && searchResults.length > 0 ? searchResults : stockSymbols;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">Stock Symbols</h1>
          <p className="text-sm text-zinc-400">
            Manage stock symbols database with real-time price tracking
          </p>
        </div>
        <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpdateAllPrices}
            disabled={isUpdatingPrices}
            className="text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800 w-full sm:w-auto"
          >
            <Activity className={`h-4 w-4 mr-2 ${isUpdatingPrices ? "animate-pulse" : ""}`} />
            {isUpdatingPrices ? "Updating..." : "Update Prices"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadStockSymbols(pagination.page, pagination.limit)}
            disabled={isLoading}
            className="text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800 w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLiveSearch(!showLiveSearch)}
            className="text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800 w-full sm:w-auto"
          >
            <Search className="h-4 w-4 mr-2" />
            {showLiveSearch ? "Hide" : "Search Live"}
          </Button>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)} className="bg-primary w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Manually
          </Button>
        </div>
      </div>

      {/* Real-Time Status and Controls */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="h-5 w-5 text-green-400" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-400" />
                )}
                <CardTitle className="text-white text-lg">Real-Time Updates</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
                  className="text-zinc-300 hover:text-white"
                >
                  {isRealTimeEnabled ? (
                    <Pause className="h-4 w-4 mr-1" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  {isRealTimeEnabled ? "Pause" : "Start"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRealTimeSettings(!showRealTimeSettings)}
                  className="text-zinc-300 hover:text-white"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-zinc-400">
                <Clock className="h-4 w-4" />
                <span>Last updated: {formatLastUpdateTime()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-zinc-400">Auto-refresh:</div>
                <Switch
                  checked={isRealTimeEnabled}
                  onCheckedChange={setIsRealTimeEnabled}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        
        {showRealTimeSettings && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-sm text-zinc-300">Update Interval:</label>
                <Select value={refreshInterval} onValueChange={(value: RefreshInterval) => setRefreshInterval(value)}>
                  <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {Object.entries(REFRESH_INTERVALS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key} className="text-white hover:bg-zinc-700">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span>Status:</span>
                <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              {isRealTimeEnabled && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <span>Updates:</span>
                  <Badge variant="outline" className="text-xs bg-zinc-700 text-zinc-300">
                    {updateCounter}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Live Stock Search Section */}
      {showLiveSearch && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="h-5 w-5" />
              Add Stock from Live Data
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Search for stocks using real-time data and add them to your database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StockSearch
              onSelect={handleAddFromLiveSearch}
              placeholder="Search for stocks to add..."
              showDetails={true}
              className="max-w-lg"
            />
          </CardContent>
        </Card>
      )}

      {/* Search Existing Stocks Section */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Database className="h-5 w-5" />
            Search Database
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Search through your existing stock symbols database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 h-4 w-4" />
            <Input
              placeholder="Search existing stocks in database..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            {isSearching && (
              <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-zinc-400" />
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 text-sm text-zinc-400">
              {searchResults.length > 0 
                ? `Found ${searchResults.length} matching symbols in database`
                : isSearching 
                  ? "Searching..." 
                  : searchQuery.length >= 2 
                    ? "No matching symbols found in database"
                    : "Type at least 2 characters to search"
              }
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={`border-zinc-800 bg-zinc-900/50 transition-all duration-300 ${
          isRealTimeEnabled ? 'border-blue-500/30 shadow-lg shadow-blue-500/10' : ''
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm text-zinc-400">Total Symbols</p>
                  <div className="flex items-center gap-2">
                    <p className={`text-xl font-semibold text-white transition-all duration-300 ${
                      isRealTimeEnabled && updateCounter > 0 ? 'scale-105' : ''
                    }`}>
                      {pagination.total || stockSymbols.length}
                    </p>
                    {isRealTimeEnabled && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                        <Badge variant="outline" className="text-xs bg-blue-900/20 border-blue-700/50 text-blue-400">
                          Live
                        </Badge>
              </div>
                    )}
            </div>
                </div>
              </div>
              {isRealTimeEnabled && updateCounter > 0 && (
                <div className="text-right">
                  <p className="text-xs text-zinc-500">Updates</p>
                  <p className="text-sm font-mono text-green-400">{updateCounter}</p>
                </div>
              )}
            </div>
            {isRealTimeEnabled && lastUpdateTime && (
              <div className="mt-2 pt-2 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last sync: {formatLastUpdateTime()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`border-zinc-800 bg-zinc-900/50 transition-all duration-300 ${
          pagination.pages > 1 ? 'border-green-500/30' : ''
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-sm text-zinc-400">Current Page</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-semibold text-white">
                      {pagination.page}
                    </p>
                    <span className="text-zinc-500">of</span>
                    <p className="text-xl font-semibold text-white">
                      {pagination.pages || 1}
                    </p>
              </div>
                </div>
              </div>
              {pagination.pages > 1 && (
                <div className="text-right">
                  <p className="text-xs text-zinc-500">Progress</p>
                  <div className="flex items-center gap-2">
                    <div className="w-12 bg-zinc-700 rounded-full h-1">
                      <div 
                        className="h-1 bg-green-400 rounded-full transition-all duration-300"
                        style={{ width: `${(pagination.page / pagination.pages) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-green-400 font-mono">
                      {Math.round((pagination.page / pagination.pages) * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-yellow-400" />
              <div>
                <p className="text-sm text-zinc-400">Per Page</p>
                <p className="text-xl font-semibold text-white">{pagination.limit}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Showing</p>
                <p className="text-sm font-mono text-yellow-400">
                  {Math.min(pagination.limit, (pagination.total || stockSymbols.length))}
                </p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-800">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">
                  Items {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total || stockSymbols.length)}
                </span>
                <Badge variant="outline" className="text-xs bg-yellow-900/20 border-yellow-700/50 text-yellow-400">
                  {displayData.length} visible
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-zinc-800 bg-zinc-900/50 transition-all duration-300 ${
          isConnected ? 'border-green-500/30' : 'border-red-500/30'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-400" />
                <div>
                  <p className="text-sm text-zinc-400">Data Status</p>
                  <div className="flex items-center gap-2">
                    <p className={`text-xl font-semibold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                      {isConnected ? 'Online' : 'Offline'}
                    </p>
                    {isConnected ? (
                      <Wifi className="h-4 w-4 text-green-400" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Mode</p>
                <div className="flex items-center gap-1">
                  <p className={`text-sm font-mono ${isRealTimeEnabled ? 'text-blue-400' : 'text-zinc-400'}`}>
                    {isRealTimeEnabled ? 'Real-time' : 'Manual'}
                  </p>
                  {isRealTimeEnabled && (
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  )}
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-800">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">
                  Refresh: {REFRESH_INTERVALS[refreshInterval].label}
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    isRealTimeEnabled 
                      ? 'bg-blue-900/20 border-blue-700/50 text-blue-400' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                >
                  {isRealTimeEnabled ? 'Auto' : 'Manual'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Data Summary */}
      {isRealTimeEnabled && (
        <Card className="border-zinc-800 bg-zinc-900/50 border-blue-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              Real-Time Data Summary
              <Badge variant="outline" className="text-xs bg-blue-900/20 border-blue-700/50 text-blue-400">
                Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <RefreshCw className={`h-4 w-4 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="text-zinc-300 font-medium">Updates</span>
                </div>
                <p className="text-xl font-bold text-blue-400">{updateCounter}</p>
                <p className="text-xs text-zinc-500 mt-1">Total refreshes</p>
              </div>
              
              <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="h-4 w-4 text-green-400" />
                  <span className="text-zinc-300 font-medium">Interval</span>
                </div>
                <p className="text-xl font-bold text-green-400">{REFRESH_INTERVALS[refreshInterval].label.split(' ')[0]}</p>
                <p className="text-xs text-zinc-500 mt-1">{REFRESH_INTERVALS[refreshInterval].label.split(' ')[1] || 'sec'}</p>
              </div>
              
              <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {isConnected ? (
                    <Wifi className="h-4 w-4 text-green-400" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-400" />
                  )}
                  <span className="text-zinc-300 font-medium">Connection</span>
                </div>
                <p className={`text-xl font-bold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {isConnected ? 'Active' : 'Lost'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">API status</p>
              </div>
              
              <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Database className="h-4 w-4 text-purple-400" />
                  <span className="text-zinc-300 font-medium">Symbols</span>
                </div>
                <p className="text-xl font-bold text-purple-400">{displayData.length}</p>
                <p className="text-xs text-zinc-500 mt-1">Currently shown</p>
              </div>
            </div>
            
            {lastUpdateTime && (
              <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                <span>Last successful update: {lastUpdateTime.toLocaleString()}</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400">Live data active</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card className="border-zinc-800 bg-zinc-900/50 shadow-md">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <CardTitle className="text-lg font-medium text-white">
            {searchQuery ? 'Search Results' : 'Stock Symbols'}
          </CardTitle>
          <CardDescription className="text-sm text-zinc-400">
            {searchQuery 
              ? `Showing search results for "${searchQuery}"`
              : "All stock symbols in the database"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 py-0">
          {/* Mobile: Add horizontal scroll wrapper for table */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-[800px]">
          <DataTable
            columns={columns}
            data={displayData}
            isLoading={isLoading}
          />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Controls with Real-time Integration */}
      {!searchQuery && pagination.pages > 1 && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadStockSymbols(1, pagination.limit)}
                    disabled={pagination.page === 1 || isLoading}
                    className="text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800"
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadStockSymbols(pagination.page - 1, pagination.limit)}
                    disabled={pagination.page === 1 || isLoading}
                    className="text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800"
                  >
                    Previous
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <span>Page</span>
                  <Badge variant="outline" className="bg-zinc-800 text-white border-zinc-600">
                    {pagination.page}
                  </Badge>
                  <span>of</span>
                  <Badge variant="outline" className="bg-zinc-800 text-white border-zinc-600">
                    {pagination.pages}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadStockSymbols(pagination.page + 1, pagination.limit)}
                    disabled={pagination.page === pagination.pages || isLoading}
                    className="text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800"
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadStockSymbols(pagination.pages, pagination.limit)}
                    disabled={pagination.page === pagination.pages || isLoading}
                    className="text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800"
                  >
                    Last
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {isRealTimeEnabled && (
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span>Auto-syncing every {REFRESH_INTERVALS[refreshInterval].label}</span>
                  </div>
                )}
                
                <div className="text-sm text-zinc-400">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} entries
                </div>
              </div>
            </div>
            
            {isRealTimeEnabled && (
              <div className="mt-3 pt-3 border-t border-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-4">
                    <span>Real-time updates will refresh current page data automatically</span>
                    <Badge variant="outline" className="text-xs bg-blue-900/20 border-blue-700/50 text-blue-400">
                      Page {pagination.page} synced
                    </Badge>
                  </div>
                  {lastUpdateTime && (
                    <span>Last sync: {formatLastUpdateTime()}</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <StockSymbolFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleAddStockSymbol}
        initialData={selectedLiveStock || undefined}
        mode="create"
      />

      <StockSymbolFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        initialData={selectedStockSymbol || undefined}
        onSubmit={handleEditStockSymbol}
        mode="edit"
      />

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Stock Symbol"
        description={`Are you sure you want to delete "${selectedStockSymbol?.symbol}"? This action cannot be undone.`}
        onConfirm={handleDeleteStockSymbol}
      />
    </div>
  );
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
} 