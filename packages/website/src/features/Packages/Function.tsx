import React, { FC, useEffect, useMemo, useState } from 'react';
import { AbiFunction, Abi } from 'abitype/src/abi';

import { ChainArtifacts } from '@usecannon/builder';
import _ from 'lodash';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Spinner,
  Text,
} from '@chakra-ui/react';
import { FunctionInput } from '@/features/Packages/FunctionInput';
import { FunctionOutput } from '@/features/Packages/FunctionOutput';
import { RefreshCw } from 'react-feather';
import {
  Chain,
  useAccount,
  useConnect,
  useNetwork,
  usePublicClient,
  useSwitchNetwork,
  useWalletClient,
} from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Address } from 'viem';
import { handleTxnError } from '@usecannon/builder';
import ethers from 'ethers'; // Remove after the builder is refactored to viem. (This is already a dependency via builder.)

export const Function: FC<{
  f: AbiFunction;
  address: string;
  cannonOutputs: ChainArtifacts;
  chainId?: number;
}> = ({ f, address, cannonOutputs, chainId }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [params, setParams] = useState<any[]>([]);
  const { isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { openConnectModal } = useConnectModal();
  const { chain: connectedChain } = useNetwork();

  const publicClient = usePublicClient({
    chainId: chainId as number,
  });
  const { switchNetworkAsync } = useSwitchNetwork();
  const { data: walletClient } = useWalletClient({
    chainId: chainId as number,
  });

  const readOnly = useMemo(
    () => f.stateMutability == 'view' || f.stateMutability == 'pure',
    [f.stateMutability]
  );

  useEffect(() => {
    _.debounce(() => {
      if (readOnly) {
        void submit();
      }
    }, 200)();
  }, [params, readOnly]);

  useEffect(() => {
    if (readOnly && params.length == 0) {
      void submit(true);
    }
  }, []);

  const submit = async (suppressError = false) => {
    setLoading(true);
    try {
      if (readOnly) {
        const _result = await publicClient.readContract<Abi, string>({
          address: address as Address,
          abi: [f],
          functionName: f.name,
          args: params,
        }); //[f.name](...params);
        setResult(_result);
      } else {
        if (!isConnected) {
          try {
            await connectAsync?.();
          } catch (e) {
            if (openConnectModal) openConnectModal();
            return;
          }
        }
        if (connectedChain?.id != chainId) {
          const newChain = await switchNetworkAsync?.(chainId as number);
          if (newChain?.id != chainId) return;
        }
        try {
          const _result = await walletClient?.writeContract<Abi, string, Chain>(
            {
              address: address as Address,
              abi: [f],
              functionName: f.name,
              args: Array.isArray(params) ? params : [params],
            }
          );
          setResult(_result);
        } catch (e) {
          console.error(e);
        }
      }
    } catch (e) {
      if (!suppressError) {
        try {
          const provider = new ethers.providers.JsonRpcProvider(
            publicClient.chain.rpcUrls.public.http[0] as string
          );
          await handleTxnError(cannonOutputs, provider, e);
          console.error(e);
        } catch (e2) {
          setError(e2);
        }
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <Box mb="6" pt="6" borderTop="1px solid rgba(255,255,255,0.15)">
      <Heading size="sm" mb="2">
        {f.name}()
      </Heading>
      {f.inputs.map((input) => {
        return (
          <Box key={JSON.stringify(input)}>
            <FormControl mb="4">
              <FormLabel color="white">
                {input.name && <Text display="inline">{input.name}</Text>}
                {input.type && (
                  <Text fontSize="xs" color="whiteAlpha.700" display="inline">
                    {input.type}
                  </Text>
                )}
              </FormLabel>
              <FunctionInput input={input} valueUpdated={setParams} />
            </FormControl>
          </Box>
        );
      })}
      {loading && (
        <Box my="4">
          <Spinner />
        </Box>
      )}
      {error && (
        <Alert mb="4" status="error" bg="red.700" v-else-if="error">
          {error}
        </Alert>
      )}
      {result != null && (
        <Box>
          <FunctionOutput result={result} output={f.outputs} />
        </Box>
      )}

      {readOnly && (result != null || error) && (
        <Box
          display="inline-block"
          py={1}
          cursor="pointer"
          color="gray.400"
          _hover={{ color: 'gray.200' }}
          transition="color 0.2s ease-in-out"
        >
          <div onClick={() => submit(false)} className="refresh-button">
            <RefreshCw size={18} />
          </div>
        </Box>
      )}

      {!readOnly && (
        <Button
          isLoading={loading}
          colorScheme="teal"
          size="sm"
          onClick={() => {
            void submit(false);
          }}
        >
          Submit Transaction
        </Button>
      )}
    </Box>
  );
};
