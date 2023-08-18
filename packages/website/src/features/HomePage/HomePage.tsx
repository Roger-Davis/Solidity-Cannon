'use client';
import { Flex, Button, Container, Heading, Link } from '@chakra-ui/react';
import NextLink from 'next/link';
import { links } from '@/constants/links';

export default function HomePage() {
  return (
    <Flex
      flexDirection="column"
      flex={1}
      minHeight="100%"
      py={4}
      bg="black"
      justify="center"
    >
      <Container maxW="container.xl" py={[12, 12, 24]}>
        <Heading
          as="h1"
          mb={[4, 4, 7]}
          fontFamily="var(--font-inter)"
          fontWeight={400}
          fontSize={['30px', '30px', '64px']}
          lineHeight={['38px', '38px', '76px']}
          letterSpacing={['-2.1px', '-2.1px', '-4.2px']}
          textShadow="0px 0px 6px rgba(63, 211, 203, 0.5);"
          maxWidth={['480px', '480px', '800px']}
        >
          Cannon manages protocol deployments on blockchains
        </Heading>
        <Heading
          as="h2"
          mb={[6, 6, 10]}
          fontFamily="var(--font-inter)"
          fontWeight={200}
          fontSize={['18px', '18px', '36px']}
          lineHeight={['23px', '23px', '46px']}
          letterSpacing={['-0.8px', '-0.8px', '-1.6px']}
          color="gray.300"
          maxW={['340px', '340px', '680px']}
        >
          Deploy protocols and publish packages to the registry, hosted on
          Ethereum and IPFS.
        </Heading>
        <Link href={links.LEARN} color="white" as={NextLink}>
          <Button
            colorScheme="teal"
            size={['sm', 'sm', 'lg']}
            letterSpacing="0.5px"
          >
            Learn more
          </Button>
        </Link>
      </Container>
    </Flex>
  );
}
