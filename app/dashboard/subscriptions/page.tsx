// app\dashboard\subscriptions\page.tsx  
"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PaymentVerificationDialog } from "@/components/payment-verification-dialog";
import { PaymentDetailsDialog } from "@/components/payment-details-dialog";
import { SubscriptionFormDialog } from "@/components/subscription-form-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  fetchPaymentHistory,
  fetchSubscriptions,
  updateSubscriptionStatus,
  cancelSubscription,
  type PaymentHistory,
  type Subscription,
} from "@/lib/api";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  CreditCard,
  PlusCircle,
  RefreshCw,
  XCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("subscriptions");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] =
    useState<Subscription | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentHistory | null>(null);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [orderData, setOrderData] = useState<{
    orderId: string;
    amount: number;
    currency: string;
  } | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [usingMockData, setUsingMockData] = useState({
    subscriptions: false,
    payments: false,
  });
  const { toast } = useToast();

  console.log("SubscriptionsPage component rendered", subscriptions);

  // Update the loadData function to handle errors better
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch subscriptions first
      let subscriptionsData: Subscription[] = [];
      let usingMockSubscriptions = false;
      try {
        subscriptionsData = await fetchSubscriptions();
      } catch (error) {
        console.error("Error loading subscriptions:", error);
        toast({
          title: "Failed to load subscriptions",
          description: "Using mock data instead",
          variant: "destructive",
        });
        // Use empty array as fallback
        subscriptionsData = [];
        usingMockSubscriptions = true;
      }

      // Then fetch payment history
      let paymentHistoryData: PaymentHistory[] = [];
      let usingMockPayments = false;
      try {
        paymentHistoryData = await fetchPaymentHistory();
      } catch (error) {
        console.error("Error loading payment history:", error);
        // This shouldn't happen now with our fallback, but just in case
        paymentHistoryData = [];
        usingMockPayments = true;
      }

      console.log("Fetched subscriptions:", paymentHistoryData);
      setSubscriptions(subscriptionsData);
      setPaymentHistory(paymentHistoryData);
      setUsingMockData({
        subscriptions: usingMockSubscriptions,
        payments: usingMockPayments,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Failed to load data",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setUsingMockData({ subscriptions: true, payments: true });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateOrderSuccess = (data: {
    orderId: string;
    amount: number;
    currency: string;
  }) => {
    setOrderData(data);
    setVerifyDialogOpen(true);
  };

  const handleVerifyPaymentSuccess = () => {
    loadData();
  };

  const openStatusDialog = (subscription: Subscription, status: string) => {
    setSelectedSubscription(subscription);
    setNewStatus(status);
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedSubscription || !newStatus) return;

    try {
      if (newStatus === "cancelled") {
        const result = await cancelSubscription(selectedSubscription.id);
        toast({
          title: "Subscription Cancelled",
          description: result.message || "The subscription has been successfully cancelled",
        });
      } else {
      await updateSubscriptionStatus(selectedSubscription.id, newStatus);
      toast({
        title: "Status Updated",
        description: `Subscription status has been updated to ${newStatus}`,
      });
      }
      setStatusDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error updating subscription status:", error);
      toast({
        title: "Failed to update status",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handlePaymentClick = (payment: PaymentHistory) => {
    setSelectedPayment(payment);
    setPaymentDetailsOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "expired":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "success":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const subscriptionColumns: ColumnDef<Subscription>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <div className="font-mono text-xs truncate max-w-[100px]">
          {row.original.id || (row.original as any)._id}
        </div>
      ),
    },
    {
      accessorKey: "userName",
      header: "User Name",
      cell: ({ row }) => (
        <div className="font-medium truncate max-w-[150px]">
          {row.original.user?.username || row.original.user?.email || "Unknown User"}
        </div>
      ),
    },
    {
      accessorKey: "portfolioName",
      header: "Portfolio Name",
      cell: ({ row }) => (
        <div className="font-medium truncate max-w-[200px]" title={row.original.portfolio?.name}>
          {row.original.portfolio?.name || "Unknown Portfolio"}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        return (
          <Badge
            className={getStatusColor(
              row.original.isActive ? "active" : "inactive"
            )}
          >
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "lastPaidAt",
      header: "Payment Date",
      cell: ({ row }) => {
        return <div>{row.original.lastPaidAt || "N/A"}</div>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const subscription = row.original;

        return (
          <div className="flex items-center justify-end space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openStatusDialog(subscription, "cancelled")}
              title="Cancel Subscription"
            >
              <XCircle className="h-4 w-4" />
              <span className="sr-only">Cancel</span>
            </Button>
          </div>
        );
      },
    },
  ];

  const paymentHistoryColumns: ColumnDef<PaymentHistory>[] = [
    {
      accessorKey: "_id",
      header: "ID",
      cell: ({ row }) => (
        <div className="font-mono text-xs truncate max-w-[100px]">
          {row.original._id}
        </div>
      ),
    },
    {
      accessorKey: "userName",
      header: "User Name",
      cell: ({ row }) => {
        const user = row.original.user;
        const displayName = typeof user === 'object' && user 
          ? (user.username || user.email || "Unknown User")
          : "Unknown User";
        return (
          <div className="font-medium truncate max-w-[150px]" title={displayName}>
            {displayName}
        </div>
        );
      },
    },
    {
      accessorKey: "portfolioName",
      header: "Portfolio Name",
      cell: ({ row }) => {
        const portfolio = row.original.portfolio;
        const displayName = typeof portfolio === 'object' && portfolio 
          ? portfolio.name 
          : "Unknown Portfolio";
        return (
          <div className="font-medium truncate max-w-[200px]" title={displayName}>
            {displayName}
        </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = row.getValue("amount") as number;
        const currency = row.original.currency;
        const formattedAmount = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: currency || 'INR',
        }).format(amount);
        return (
          <div className="font-medium text-green-600">
            {formattedAmount}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return status ? (
          <Badge className={getPaymentStatusColor(status)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => (
        <div>{formatDate(row.getValue("createdAt") as string)}</div>
      ),
    },
    {
      accessorKey: "orderId",
      header: "Order ID",
      cell: ({ row }) => (
        <button
          onClick={() => handlePaymentClick(row.original)}
          className="font-mono text-xs truncate max-w-[100px] text-blue-600 hover:text-blue-800 hover:underline text-left"
          title="Click to view payment details"
        >
          {row.getValue("orderId")}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Subscription Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage user subscriptions and payments
          </p>
        </div>
        <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-2">
          <Button onClick={() => loadData()} variant="outline" className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Link href="/dashboard/subscriptions/active">
            <Button variant="outline" className="w-full sm:w-auto">
              <Users className="mr-2 h-4 w-4" />
              Active Subscriptions
            </Button>
          </Link>
          <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-none sm:inline-flex">
          <TabsTrigger value="subscriptions" className="text-xs sm:text-sm">Subscriptions</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs sm:text-sm">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
              <CardDescription>
                View and manage user subscriptions
                {usingMockData.subscriptions && (
                  <span className="block mt-1 text-xs text-amber-500">
                    Note: Showing mock data as the subscriptions API is not
                    available
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usingMockData.subscriptions && (
                <Alert variant="warning" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Using Mock Data</AlertTitle>
                  <AlertDescription>
                    The subscription data shown is mock data. The API returned
                    an HTML response instead of JSON.
                  </AlertDescription>
                </Alert>
              )}

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                  <h3 className="mt-4 text-lg font-semibold">
                    No Subscriptions Found
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    There are no subscriptions in the system yet.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Order
                  </Button>
                </div>
              ) : (
                <DataTable columns={subscriptionColumns} data={subscriptions} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>
                View payment history for all subscriptions
                {usingMockData.payments && (
                  <span className="block mt-1 text-xs text-amber-500">
                    Note: Showing mock data as the payment history API is not
                    available
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usingMockData.payments && (
                <Alert variant="warning" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Using Mock Data</AlertTitle>
                  <AlertDescription>
                    The payment history shown is mock data. The API returned an
                    HTML response instead of JSON.
                  </AlertDescription>
                </Alert>
              )}

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                  <h3 className="mt-4 text-lg font-semibold">
                    No Payment History
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    There are no payment records in the system yet.
                  </p>
                </div>
              ) : (
                <DataTable
                  columns={paymentHistoryColumns}
                  data={paymentHistory}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Order Dialog */}
      <SubscriptionFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateOrderSuccess}
      />

      {/* Payment Verification Dialog */}
      <PaymentVerificationDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        orderData={orderData}
        onSuccess={handleVerifyPaymentSuccess}
      />

      {/* Status Update Confirmation Dialog */}
      <ConfirmDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        onConfirm={handleUpdateStatus}
        title={`${newStatus === "active" ? "Activate" : "Cancel"} Subscription`}
        description={`Are you sure you want to ${
          newStatus === "active" ? "activate" : "cancel"
        } this subscription? This will ${
          newStatus === "active" ? "enable" : "disable"
        } access to the portfolio.${
          newStatus === "cancelled" ? " Note: Yearly subscriptions may have a commitment period during which cancellation is not allowed." : ""
        }`}
        confirmText={
          newStatus === "active" ? "Activate" : "Cancel Subscription"
        }
      />

      {/* Payment Details Dialog */}
      <PaymentDetailsDialog
        open={paymentDetailsOpen}
        onOpenChange={setPaymentDetailsOpen}
        payment={selectedPayment}
      />
    </div>
  );
}
