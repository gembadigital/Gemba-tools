import React, { createContext, useContext, useState, useEffect } from "react";
import { Customer } from "../types";

export interface GlobalFactoryState {
  CurrentCompanyID: string;
  CurrentFactoryID: string;
  CurrentCompanyName: string;
  CurrentFactoryName: string;
  CurrentSector: string;
  CurrentLayout: string;
  CurrentUser: any;
  CurrentRole: string;
  CurrentLanguage: string;
}

interface FactoryContextType {
  globalState: GlobalFactoryState;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  currentLanguage: string;
  setCurrentLanguage: (lang: string) => void;
  selectedCustomer: Customer;
}

const FactoryContext = createContext<FactoryContextType | undefined>(undefined);

export const useFactory = () => {
  const context = useContext(FactoryContext);
  if (!context) {
    throw new Error("useFactory must be used within a FactoryProvider");
  }
  return context;
};

interface FactoryProviderProps {
  children: React.ReactNode;
  currentUser: any;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  selectedCustomer: Customer;
}

export function FactoryProvider({
  children,
  currentUser,
  customers,
  setCustomers,
  selectedCustomerId,
  setSelectedCustomerId,
  selectedCustomer,
}: FactoryProviderProps) {
  const [currentLanguage, setCurrentLanguage] = useState<string>("tr");

  // Define global state based on active factory context
  const globalState: GlobalFactoryState = {
    CurrentCompanyID: selectedCustomer?.id || "",
    CurrentFactoryID: selectedCustomerId || "",
    CurrentCompanyName: selectedCustomer?.companyName || "",
    CurrentFactoryName: selectedCustomer?.companyName || "",
    CurrentSector: selectedCustomer?.industry || "",
    CurrentLayout: selectedCustomer?.productionType || "",
    CurrentUser: currentUser,
    CurrentRole: currentUser?.role || "User",
    CurrentLanguage: currentLanguage,
  };

  // Setup Global Event System
  useEffect(() => {
    const handleFactoryChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newFactoryId = customEvent.detail?.factoryId;
      if (newFactoryId && newFactoryId !== selectedCustomerId) {
        setSelectedCustomerId(newFactoryId);
      }
    };

    window.addEventListener("FactoryChanged", handleFactoryChanged);
    return () => {
      window.removeEventListener("FactoryChanged", handleFactoryChanged);
    };
  }, [selectedCustomerId, setSelectedCustomerId]);

  return (
    <FactoryContext.Provider
      value={{
        globalState,
        selectedCustomerId,
        setSelectedCustomerId,
        customers,
        setCustomers,
        currentLanguage,
        setCurrentLanguage,
        selectedCustomer,
      }}
    >
      {children}
    </FactoryContext.Provider>
  );
}
