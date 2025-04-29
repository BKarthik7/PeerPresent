import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { peerLoginSchema, adminLoginSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LoginModal() {
  const { loginAsPeer, loginAsAdmin, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("peer");

  // Peer login form
  const peerForm = useForm<z.infer<typeof peerLoginSchema>>({
    resolver: zodResolver(peerLoginSchema),
    defaultValues: {
      name: "",
      usn: "",
    },
  });

  // Admin login form
  const adminForm = useForm<z.infer<typeof adminLoginSchema>>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      password: "",
    },
  });

  const onPeerSubmit = async (values: z.infer<typeof peerLoginSchema>) => {
    await loginAsPeer(values.name, values.usn);
  };

  const onAdminSubmit = async (values: z.infer<typeof adminLoginSchema>) => {
    await loginAsAdmin(values.password);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-google-sans">Peer Evaluation System</CardTitle>
          <CardDescription>
            Login to participate in the evaluation session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="peer" onValueChange={setActiveTab} value={activeTab}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="peer">Peer Login</TabsTrigger>
              <TabsTrigger value="admin">Admin Login</TabsTrigger>
            </TabsList>
            
            <TabsContent value="peer">
              <Form {...peerForm}>
                <form onSubmit={peerForm.handleSubmit(onPeerSubmit)} className="space-y-4">
                  <FormField
                    control={peerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={peerForm.control}
                    name="usn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>USN</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your USN" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? "Logging in..." : "Enter as Peer"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="admin">
              <Form {...adminForm}>
                <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-4">
                  <FormField
                    control={adminForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter admin password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? "Logging in..." : "Enter as Admin"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Peer-to-Peer Evaluation System
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
