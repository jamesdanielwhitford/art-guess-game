import ArtGuessingGame from './components/ArtGuessingGame'

function App() {
  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Daily Art Challenge</h1>
        <ArtGuessingGame />
      </div>
    </div>
  )
}

export default App