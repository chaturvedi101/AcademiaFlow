
'use client';

import { useEffect, useState } from 'react';
import { Query, onSnapshot, CollectionReference } from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '../errors';

export function useCollection<T>(query: Query | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        setData(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as T)));
        setLoading(false);
      },
      async (serverError) => {
        // Attempt to extract the path from the query if it's a collection reference
        let path = 'collection';
        if ('path' in query) {
          path = (query as unknown as CollectionReference).path;
        }

        const permissionError = new FirestorePermissionError({
          path: path,
          operation: 'list',
        } satisfies SecurityRuleContext);

        // Emit the contextual error for the development overlay
        errorEmitter.emit('permission-error', permissionError);
        
        setError(serverError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
}
