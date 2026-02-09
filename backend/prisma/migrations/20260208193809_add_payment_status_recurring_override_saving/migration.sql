-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "expense_payment_statuses" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_payment_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_overrides" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_payment_statuses_expenseId_idx" ON "expense_payment_statuses"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_payment_statuses_expenseId_month_year_key" ON "expense_payment_statuses"("expenseId", "month", "year");

-- CreateIndex
CREATE INDEX "recurring_overrides_expenseId_idx" ON "recurring_overrides"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_overrides_expenseId_month_year_key" ON "recurring_overrides"("expenseId", "month", "year");

-- CreateIndex
CREATE INDEX "savings_householdId_idx" ON "savings"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "savings_userId_month_year_isShared_key" ON "savings"("userId", "month", "year", "isShared");

-- AddForeignKey
ALTER TABLE "expense_payment_statuses" ADD CONSTRAINT "expense_payment_statuses_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_payment_statuses" ADD CONSTRAINT "expense_payment_statuses_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_overrides" ADD CONSTRAINT "recurring_overrides_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings" ADD CONSTRAINT "savings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings" ADD CONSTRAINT "savings_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
