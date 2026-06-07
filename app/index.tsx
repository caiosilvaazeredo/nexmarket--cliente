import React from 'react';
import { Redirect } from 'expo-router';

/** Entry route → straight into the storefront tabs (guest browsing allowed). */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
