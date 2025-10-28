import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { lendingCircleAddress, lendingCircleAbi, mockStakeTokenAddress, mockStakeTokenAbi } from './contract';
import './App.css';

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);
  const [availableResources, setAvailableResources] = useState([]);
  const [borrowedResources, setBorrowedResources] = useState([]);
  const [resourceName, setResourceName] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [latePenalty, setLatePenalty] = useState('');
  const [onTimeReward, setOnTimeReward] = useState('');
  const [borrowDuration, setBorrowDuration] = useState('');
  const [resourceType, setResourceType] = useState(1);
  const [maxBorrows, setMaxBorrows] = useState('');
  const [metadataURI, setMetadataURI] = useState('');
  const [rewardPool, setRewardPool] = useState('0');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const contract = new ethers.Contract(lendingCircleAddress, lendingCircleAbi, signer);
        const tokenContract = new ethers.Contract(mockStakeTokenAddress, mockStakeTokenAbi, signer);
        setAccount(address);
        setContract(contract);
        setTokenContract(tokenContract);
      } catch (error) {
        console.error('Error connecting to wallet:', error);
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  const getRewardPoolBalance = async () => {
    if (contract) {
      try {
        const balance = await contract.rewardPool();
        setRewardPool(ethers.formatEther(balance));
      } catch (error) {
        console.error('Error fetching reward pool balance:', error);
      }
    }
  };

  const getAvailableResources = async () => {
    if (contract) {
      try {
        const resources = await contract.getAvailableResources();
        const resourceDetails = await Promise.all(
          resources.map(async (resourceId) => {
            const details = await contract.getResourceDetails(resourceId);
            return {
              id: details.id.toString(),
              name: details.name,
            };
          })
        );
        setAvailableResources(resourceDetails);
      } catch (error) {
        console.error('Error fetching available resources:', error);
      }
    }
  };

  const getMyBorrowedResources = async () => {
    if (contract) {
      try {
        const resources = await contract.getMyBorrowedResources();
        const resourceDetails = await Promise.all(
          resources.map(async (resourceId) => {
            const details = await contract.getResourceDetails(resourceId);
            return {
              id: details.id.toString(),
              name: details.name,
            };
          })
        );
        setBorrowedResources(resourceDetails);
      } catch (error) {
        console.error('Error fetching borrowed resources:', error);
      }
    }
  };

  const addResource = async (e) => {
    e.preventDefault();
    if (contract) {
      try {
        const tx = await contract.addResource(
          resourceName,
          resourceType,
          maxBorrows,
          ethers.parseEther(stakeAmount),
          borrowDuration,
          ethers.parseEther(latePenalty),
          ethers.parseEther(onTimeReward),
          metadataURI
        );
        await tx.wait();
        setResourceName('');
        setStakeAmount('');
        setLatePenalty('');
        setOnTimeReward('');
        setBorrowDuration('');
        setMaxBorrows('');
        setMetadataURI('');
        getAvailableResources();
      } catch (error) {
        console.error('Error adding resource:', error);
      }
    }
  };

  const mintTokens = async () => {
    if (tokenContract) {
      try {
        const tx = await tokenContract.mint(account, ethers.parseEther('1000'));
        await tx.wait();
        alert('1000 MST tokens minted to your account!');
      } catch (error) {
        console.error('Error minting tokens:', error);
      }
    }
  }

  const depositToRewardPool = async (e) => {
    e.preventDefault();
    if (contract && tokenContract) {
      try {
        const approveTx = await tokenContract.approve(lendingCircleAddress, ethers.parseEther(depositAmount));
        await approveTx.wait();

        const tx = await contract.depositToRewardPool(ethers.parseEther(depositAmount));
        await tx.wait();
        setDepositAmount('');
        getRewardPoolBalance();
      } catch (error) {
        console.error('Error depositing to reward pool:', error);
      }
    }
  };

  const withdrawFromRewardPool = async (e) => {
    e.preventDefault();
    if (contract) {
      try {
        const tx = await contract.withdrawFromRewardPool(ethers.parseEther(withdrawAmount));
        await tx.wait();
        setWithdrawAmount('');
        getRewardPoolBalance();
      } catch (error) {
        console.error('Error withdrawing from reward pool:', error);
      }
    }
  };

  const borrowResource = async (resourceId) => {
    if (contract && tokenContract) {
      try {
        const resource = await contract.getResourceDetails(resourceId);
        const stake = resource.stakeAmount;
        const approveTx = await tokenContract.approve(lendingCircleAddress, stake);
        await approveTx.wait();

        const tx = await contract.borrowResource(resourceId);
        await tx.wait();
        getAvailableResources();
        getMyBorrowedResources();
      } catch (error) {
        console.error('Error borrowing resource:', error);
      }
    }
  };

  const returnResource = async (resourceId) => {
    if (contract) {
      try {
        const tx = await contract.returnResource(resourceId);
        await tx.wait();
        getAvailableResources();
        getMyBorrowedResources();
      } catch (error) {
        console.error('Error returning resource:', error);
      }
    }
  };

  useEffect(() => {
    if (contract) {
      getAvailableResources();
      getMyBorrowedResources();
      getRewardPoolBalance();
    }
  }, [contract]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Lending Circle</h1>
        {account ? (
          <p>Connected: {account}</p>
        ) : (
          <button onClick={connectWallet}>Connect Wallet</button>
        )}
      </header>
      <main>
        <section>
          <h2>Add a Resource</h2>
          <form onSubmit={addResource}>
            <input type="text" placeholder="Resource Name" value={resourceName} onChange={(e) => setResourceName(e.target.value)} required />
            <input type="text" placeholder="Stake Amount (ETH)" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} required />
            <input type="text" placeholder="Late Penalty (ETH per day)" value={latePenalty} onChange={(e) => setLatePenalty(e.target.value)} required />
            <input type="text" placeholder="On-Time Reward (ETH)" value={onTimeReward} onChange={(e) => setOnTimeReward(e.target.value)} required />
            <input type="text" placeholder="Borrow Duration (seconds)" value={borrowDuration} onChange={(e) => setBorrowDuration(e.target.value)} required />
            <input type="text" placeholder="Max Concurrent Borrows" value={maxBorrows} onChange={(e) => setMaxBorrows(e.target.value)} required />
            <input type="text" placeholder="Metadata URI" value={metadataURI} onChange={(e) => setMetadataURI(e.target.value)} />
            <select value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
              <option value={0}>Physical</option>
              <option value={1}>Digital</option>
            </select>
            <button type="submit">Add Resource</button>
          </form>
        </section>
        <section>
          <h2>Reward Pool</h2>
          <p>Balance: {rewardPool} MST</p>
          <form onSubmit={depositToRewardPool}>
            <input type="text" placeholder="Amount to Deposit" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} required />
            <button type="submit">Deposit</button>
          </form>
          <form onSubmit={withdrawFromRewardPool}>
            <input type="text" placeholder="Amount to Withdraw" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} required />
            <button type="submit">Withdraw</button>
          </form>
        </section>
        <section>
          <h2>Mint Tokens</h2>
          <button onClick={mintTokens}>Mint 1000 MST</button>
        </section>
        <section>
          <h2>Available Resources</h2>
          <ul>
            {availableResources.map((resource) => (
              <li key={resource.id}>
                {resource.name} <button onClick={() => borrowResource(resource.id)}>Borrow</button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>My Borrowed Resources</h2>
          <ul>
            {borrowedResources.map((resource) => (
              <li key={resource.id}>
                {resource.name} <button onClick={() => returnResource(resource.id)}>Return</button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;