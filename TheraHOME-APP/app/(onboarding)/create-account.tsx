import React from 'react';
import { CreateAccountForm } from '@/components/onboarding/CreateAccountForm';

/** The route. The form lives in a component because `login` renders it too,
 * for a device that has never signed in — see CreateAccountForm. */
export default function CreateAccountScreen() {
  return <CreateAccountForm />;
}
