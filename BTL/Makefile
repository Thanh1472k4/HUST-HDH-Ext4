CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=gnu11
TARGET = ext4_inspect
SRC = ext4_inspect.c
TEST_DIR = /home/thanh/ext4_test_suite

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) -o $(TARGET) $(SRC)

clean:
	rm -f $(TARGET)

test: $(TARGET)
	@./create_test_cases.sh
	@./$(TARGET) $(TEST_DIR)/case1_contiguous.dat

test-all: $(TARGET)
	@./create_test_cases.sh
	@echo "\n=== [TEST 1] CONTIGUOUS FILE ==="
	@./$(TARGET) $(TEST_DIR)/case1_contiguous.dat
	@echo "\n=== [TEST 2] SPARSE FILE (HOLES) ==="
	@./$(TARGET) $(TEST_DIR)/case2_sparse.dat
	@echo "\n=== [TEST 3] PREALLOCATED FILE (UNWRITTEN) ==="
	@./$(TARGET) $(TEST_DIR)/case3_preallocated.dat
	@echo "\n=== [TEST 4] FRAGMENTED FILE ==="
	@./$(TARGET) $(TEST_DIR)/case4_fragmented.dat

run-case1: $(TARGET)
	@./$(TARGET) $(TEST_DIR)/case1_contiguous.dat

run-case2: $(TARGET)
	@./$(TARGET) $(TEST_DIR)/case2_sparse.dat

run-case3: $(TARGET)
	@./$(TARGET) $(TEST_DIR)/case3_preallocated.dat

run-case4: $(TARGET)
	@./$(TARGET) $(TEST_DIR)/case4_fragmented.dat

.PHONY: all clean test test-all run-case1 run-case2 run-case3 run-case4
