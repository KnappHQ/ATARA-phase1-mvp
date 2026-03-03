import { useState, useCallback } from "react";

export interface GroupMember {
  id: string;
  name: string;
  address: string;
  avatar: string;
}

export interface GroupExpense {
  id: string;
  paidById: string;
  paidByName: string;
  amount: number;
  description: string;
  date: string;
}

export interface Group {
  id: string;
  name: string;
  members: GroupMember[];
  expenses: GroupExpense[];
  createdAt: string;
}

// Dummy groups data
const DUMMY_GROUPS: Group[] = [
  {
    id: "group-1",
    name: "Thailand Trip",
    members: [
      {
        id: "self",
        name: "You",
        address: "0x0000000000000000000000000000000000000000",
        avatar: "YO",
      },
      {
        id: "m1",
        name: "Marcus Chen",
        address: "0x71C7656EC7ab88b098defB751B7401B5f6d89742",
        avatar: "MC",
      },
      {
        id: "m2",
        name: "Elena Rodriguez",
        address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeCd8",
        avatar: "ER",
      },
      {
        id: "m3",
        name: "Sarah Kim",
        address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        avatar: "SK",
      },
    ],
    expenses: [
      {
        id: "exp-1",
        paidById: "self",
        paidByName: "You",
        amount: 3200,
        description: "Flight tickets",
        date: "Dec 15, 2024",
      },
      {
        id: "exp-2",
        paidById: "m1",
        paidByName: "Marcus Chen",
        amount: 1450,
        description: "Hotel accommodation",
        date: "Dec 16, 2024",
      },
      {
        id: "exp-3",
        paidById: "m2",
        paidByName: "Elena Rodriguez",
        amount: 850,
        description: "Meals & dining",
        date: "Dec 17, 2024",
      },
      {
        id: "exp-4",
        paidById: "m3",
        paidByName: "Sarah Kim",
        amount: 560,
        description: "Activities & tours",
        date: "Dec 18, 2024",
      },
    ],
    createdAt: "Dec 15, 2024",
  },
  {
    id: "group-2",
    name: "Roommates",
    members: [
      {
        id: "self",
        name: "You",
        address: "0x0000000000000000000000000000000000000000",
        avatar: "YO",
      },
      {
        id: "m4",
        name: "James Wilson",
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        avatar: "JW",
      },
      {
        id: "m5",
        name: "Alex Thompson",
        address: "0x6B175474E89094C44Da98b954EesfdA60F3F80C",
        avatar: "AT",
      },
    ],
    expenses: [
      {
        id: "exp-5",
        paidById: "self",
        paidByName: "You",
        amount: 1200,
        description: "Rent - December",
        date: "Dec 1, 2024",
      },
      {
        id: "exp-6",
        paidById: "m4",
        paidByName: "James Wilson",
        amount: 240,
        description: "Utilities & internet",
        date: "Dec 5, 2024",
      },
      {
        id: "exp-7",
        paidById: "m5",
        paidByName: "Alex Thompson",
        amount: 180,
        description: "Groceries",
        date: "Dec 10, 2024",
      },
    ],
    createdAt: "Sep 1, 2024",
  },
  {
    id: "group-3",
    name: "Weekend Dinner",
    members: [
      {
        id: "self",
        name: "You",
        address: "0x0000000000000000000000000000000000000000",
        avatar: "YO",
      },
      {
        id: "m1",
        name: "Marcus Chen",
        address: "0x71C7656EC7ab88b098defB751B7401B5f6d89742",
        avatar: "MC",
      },
      {
        id: "m3",
        name: "Sarah Kim",
        address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        avatar: "SK",
      },
    ],
    expenses: [
      {
        id: "exp-8",
        paidById: "self",
        paidByName: "You",
        amount: 285,
        description: "Dinner at Sushi Palace",
        date: "Dec 20, 2024",
      },
    ],
    createdAt: "Dec 20, 2024",
  },
];

export const useGroups = () => {
  const [groups, setGroups] = useState<Group[]>(DUMMY_GROUPS);

  const createGroup = useCallback((name: string, members: GroupMember[]) => {
    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name,
      members,
      expenses: [],
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
    setGroups((prev) => [newGroup, ...prev]);
    return newGroup;
  }, []);

  const addExpense = useCallback(
    (
      groupId: string,
      paidById: string,
      paidByName: string,
      amount: number,
      description: string,
    ) => {
      setGroups((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? {
                ...group,
                expenses: [
                  {
                    id: `exp-${Date.now()}`,
                    paidById,
                    paidByName,
                    amount,
                    description,
                    date: new Date().toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }),
                  },
                  ...group.expenses,
                ],
              }
            : group,
        ),
      );
    },
    [],
  );

  const calculateBalances = useCallback((group: Group) => {
    const memberBalances: Record<string, number> = {};

    // Initialize balances
    group.members.forEach((member) => {
      memberBalances[member.id] = 0;
    });

    // Calculate splits
    group.expenses.forEach((expense) => {
      const perPerson = expense.amount / group.members.length;

      // Person who paid gets credited
      memberBalances[expense.paidById] += expense.amount;

      // All members owe their share
      group.members.forEach((member) => {
        memberBalances[member.id] -= perPerson;
      });
    });

    return memberBalances;
  }, []);

  const getUserBalance = useCallback(
    (group: Group) => {
      const balances = calculateBalances(group);
      const userBalance = balances["self"] || 0;

      return {
        youOwe: Math.max(0, -userBalance),
        groupOwesYou: Math.max(0, userBalance),
        net: userBalance,
      };
    },
    [calculateBalances],
  );

  return {
    groups,
    createGroup,
    addExpense,
    calculateBalances,
    getUserBalance,
  };
};
