"use client";

import Stepper, { Step } from "@/components/ui/vendor/reactbits/Stepper";

/** Where the new staff member is in onboarding (display only; the form below does the work). */
export function OnboardingSteps() {
  return (
    <Stepper step={2} showFooter={false} disableStepIndicators linear indicator="numbers" width="100%" transition="none" aria-label="Onboarding progress">
      <Step title="Accept invite" />
      <Step title="Set password" />
      <Step title="Start writing" />
    </Stepper>
  );
}
